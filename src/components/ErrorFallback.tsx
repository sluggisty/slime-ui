import React from 'react'
import { AlertTriangle, RefreshCw, Bug, Home, ChevronLeft } from 'lucide-react'
import { ErrorFallbackProps } from './ErrorBoundary'
import styles from './ErrorFallback.module.css'

/**
 * Error Fallback component that displays user-friendly error UI
 * when a React component throws an error.
 */
export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  context,
  onRetry,
  onReport,
  onReset,
  canRetry = false,
  level = 'component'
}) => {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isGlobalError = level === 'global'

  // Determine error severity and messaging based on level
  const getErrorConfig = () => {
    switch (level) {
      case 'global':
        return {
          title: 'Something went wrong',
          message: 'The application encountered an unexpected error. Please refresh the page to continue.',
          icon: AlertTriangle,
          showHomeButton: true,
          showDetails: isDevelopment
        }
      case 'route':
        return {
          title: 'Page Error',
          message: 'This page encountered an error. You can try refreshing or go back to the previous page.',
          icon: AlertTriangle,
          showBackButton: true,
          showDetails: isDevelopment
        }
      default:
        return {
          title: 'Component Error',
          message: 'A part of this page encountered an error. You can try refreshing this section.',
          icon: Bug,
          showDetails: isDevelopment
        }
    }
  }

  const config = getErrorConfig()
  const IconComponent = config.icon

  return (
    <div className={styles.container}>
      <div className={styles.errorCard}>
        <div className={styles.iconContainer}>
          <IconComponent size={48} className={styles.errorIcon} />
        </div>

        <div className={styles.content}>
          <h2 className={styles.title}>{config.title}</h2>
          <p className={styles.message}>{config.message}</p>

          <div className={styles.actions}>
            {canRetry && onRetry && (
              <button
                onClick={onRetry}
                className={styles.retryButton}
                aria-label="Try again"
              >
                <RefreshCw size={16} />
                Try Again
              </button>
            )}

            {onReset && (
              <button
                onClick={onReset}
                className={styles.resetButton}
                aria-label="Reset error"
              >
                Reset
              </button>
            )}

            {config.showBackButton && (
              <button
                onClick={() => window.history.back()}
                className={styles.secondaryButton}
                aria-label="Go back"
              >
                <ChevronLeft size={16} />
                Go Back
              </button>
            )}

            {config.showHomeButton && (
              <button
                onClick={() => window.location.href = '/'}
                className={styles.secondaryButton}
                aria-label="Go to home"
              >
                <Home size={16} />
                Go Home
              </button>
            )}

            <button
              onClick={() => window.location.reload()}
              className={styles.secondaryButton}
              aria-label="Refresh page"
            >
              <RefreshCw size={16} />
              Refresh Page
            </button>

            {onReport && (
              <button
                onClick={onReport}
                className={styles.reportButton}
                aria-label="Report error"
              >
                <Bug size={16} />
                Report Error
              </button>
            )}
          </div>

          {config.showDetails && (
            <details className={styles.details}>
              <summary className={styles.detailsSummary}>
                Error Details (Development Only)
              </summary>

              <div className={styles.errorDetails}>
                <div className={styles.detailSection}>
                  <h4>Error Message:</h4>
                  <pre className={styles.errorText}>{error.message}</pre>
                </div>

                {error.stack && (
                  <div className={styles.detailSection}>
                    <h4>Stack Trace:</h4>
                    <pre className={styles.stackTrace}>{error.stack}</pre>
                  </div>
                )}

                {errorInfo?.componentStack && (
                  <div className={styles.detailSection}>
                    <h4>Component Stack:</h4>
                    <pre className={styles.componentStack}>{errorInfo.componentStack}</pre>
                  </div>
                )}

                {context && (
                  <div className={styles.detailSection}>
                    <h4>Context:</h4>
                    <pre className={styles.context}>
                      {JSON.stringify(context, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>

        <div className={styles.footer}>
          <p className={styles.footerText}>
            If this problem persists, please contact support with the error details above.
          </p>
          {context?.sessionId && (
            <p className={styles.sessionId}>
              Session ID: {context.sessionId}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Minimal error fallback for critical errors
 */
export const MinimalErrorFallback: React.FC<ErrorFallbackProps> = ({
  onRetry,
  canRetry
}) => {
  return (
    <div className={styles.minimalContainer}>
      <div className={styles.minimalContent}>
        <AlertTriangle size={24} className={styles.minimalIcon} />
        <p>Something went wrong</p>
        {canRetry && onRetry && (
          <button onClick={onRetry} className={styles.minimalRetry}>
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Inline error fallback for smaller components
 */
export const InlineErrorFallback: React.FC<ErrorFallbackProps> = ({
  onRetry,
  canRetry,
  error
}) => {
  return (
    <div className={styles.inlineContainer}>
      <div className={styles.inlineContent}>
        <Bug size={16} className={styles.inlineIcon} />
        <span className={styles.inlineText}>
          {process.env.NODE_ENV === 'development' ? error.message : 'Component error'}
        </span>
        {canRetry && onRetry && (
          <button onClick={onRetry} className={styles.inlineRetry}>
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
