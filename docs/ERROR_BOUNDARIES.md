# React Error Boundaries Implementation

This document describes the comprehensive error boundary system implemented in the Slime UI application.

## Overview

Error boundaries are React components that catch JavaScript errors anywhere in their component tree, log those errors, and display a fallback UI instead of crashing the entire application.

## Architecture

### Components

#### `ErrorBoundary` (`src/components/ErrorBoundary.tsx`)
- **Purpose**: Main error boundary component that catches and handles errors
- **Features**:
  - Catches errors in component tree
  - Logs errors with context
  - Provides retry functionality
  - Supports different error levels (global, route, component)
  - Automatic error reporting

#### `ErrorFallback` (`src/components/ErrorFallback.tsx`)
- **Purpose**: Displays user-friendly error UI when errors occur
- **Features**:
  - Multiple fallback variants (full, minimal, inline)
  - Context-aware messaging
  - Recovery actions (retry, reset, report)
  - Development vs production modes

#### `ErrorTestComponent` (`src/components/ErrorTestComponent.tsx`)
- **Purpose**: Test component for demonstrating error scenarios
- **Features**:
  - Various error types (sync/async)
  - Recovery demonstrations
  - Development testing tool

### Utilities

#### `errorLogger` (`src/utils/errorLogger.ts`)
- **Purpose**: Centralized error logging and reporting
- **Features**:
  - Persistent error storage (localStorage)
  - External service reporting
  - Error statistics and analytics
  - Session-based error tracking

#### `useErrorRecovery` (`src/hooks/useErrorRecovery.ts`)
- **Purpose**: Hook for error recovery with retry logic
- **Features**:
  - Automatic retry with exponential backoff
  - Configurable retry limits
  - Async operation recovery

## Usage

### Global Error Boundary

```tsx
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary level="global" enableRetry={true}>
      <YourApp />
    </ErrorBoundary>
  )
}
```

### Route-Level Error Boundaries

```tsx
<ErrorBoundary level="route" context={{ route: '/dashboard' }} enableRetry={true}>
  <Dashboard />
</ErrorBoundary>
```

### Component-Level Error Boundaries

```tsx
<ErrorBoundary level="component" enableRetry={false}>
  <ComplexComponent />
</ErrorBoundary>
```

### Using Error Recovery Hook

```tsx
import { useAsyncWithRecovery } from './hooks/useErrorRecovery'

function MyComponent() {
  const { data, loading, error, execute, hasError, retry } = useAsyncWithRecovery(
    async () => {
      const response = await fetch('/api/data')
      return response.json()
    },
    {
      maxRetries: 3,
      retryDelay: 1000,
      context: 'data-fetching'
    }
  )

  if (hasError) {
    return (
      <div>
        <p>Error: {error.message}</p>
        <button onClick={retry}>Retry</button>
      </div>
    )
  }

  return <div>{/* Render data */}</div>
}
```

## Error Levels

### Global Level
- **Scope**: Entire application
- **Fallback**: Full page error UI
- **Recovery**: Refresh page, go home
- **Context**: Application-wide errors

### Route Level
- **Scope**: Specific routes/pages
- **Fallback**: Page-level error UI
- **Recovery**: Go back, retry route
- **Context**: Route-specific errors

### Component Level
- **Scope**: Individual components
- **Fallback**: Component-specific error UI
- **Recovery**: Retry component, reset state
- **Context**: Component-specific errors

## Error Context

Error boundaries collect rich context information:

```typescript
interface ErrorContext {
  componentStack?: string
  userId?: string
  route?: string
  userAgent?: string
  timestamp: number
  sessionId?: string
  retryCount?: number
}
```

## Error Reporting

### Automatic Reporting
Errors are automatically reported when they occur:

```typescript
// In ErrorBoundary
await errorLogger.reportError(error, errorInfo, context)
```

### Manual Reporting
Users can manually report errors:

```tsx
const { reportError } = useErrorRecovery()

<button onClick={reportError}>Report Error</button>
```

### External Service Integration
Configure error reporting endpoint:

```bash
# Environment variable
VITE_ERROR_REPORTING_URL=https://your-error-service.com/api/errors
```

## Configuration Options

### ErrorBoundary Props

```typescript
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
```

### Error Recovery Options

```typescript
interface ErrorRecoveryOptions {
  maxRetries?: number
  retryDelay?: number
  exponentialBackoff?: boolean
  onRetry?: (attempt: number) => void
  onError?: (error: Error) => void
  onSuccess?: () => void
}
```

## Error Logging

### Console Logging (Development)
```javascript
// Grouped error logs in development
🚨 ERROR: Component failed to render
  Error: TypeError: Cannot read property 'x' of undefined
  Component Stack: Component@http://localhost:3000/src/Component.tsx:10:5
  Context: { route: '/dashboard', timestamp: 1234567890 }
```

### Persistent Logging
- Errors stored in localStorage for last 24 hours
- Session-based error tracking
- Export functionality for debugging

### Statistics
```typescript
const stats = errorLogger.getStats()
// {
//   total: 5,
//   session: 3,
//   unresolved: 1,
//   byLevel: { error: 2, warning: 1, info: 0 }
// }
```

## Best Practices

### 1. Strategic Placement
- Global boundary at app root
- Route boundaries for major sections
- Component boundaries for complex components

### 2. Error Context
```tsx
<ErrorBoundary
  level="component"
  context={{
    component: 'UserProfile',
    userId: currentUser?.id,
    timestamp: Date.now()
  }}
>
  <UserProfile userId={userId} />
</ErrorBoundary>
```

### 3. Recovery Strategies
```tsx
// For data fetching
const { execute, hasError, canRetry } = useAsyncWithRecovery(fetchData, {
  maxRetries: 3,
  onError: (error) => {
    // Log to monitoring service
    analytics.track('data_fetch_error', { error: error.message })
  }
})
```

### 4. User Communication
- Clear error messages
- Recovery options when possible
- Report functionality for debugging

### 5. Monitoring
```tsx
// Global error handler
const handleGlobalError = async (error, errorInfo, context) => {
  // Send to monitoring service
  await errorLogger.reportError(error, errorInfo, context)

  // Track in analytics
  analytics.track('javascript_error', {
    error: error.message,
    component: context?.component,
    route: context?.route
  })
}
```

## Testing

### Error Boundary Testing
```tsx
import { ErrorBoundary } from './ErrorBoundary'

const ErrorComponent = () => {
  throw new Error('Test error')
}

it('catches component errors', () => {
  render(
    <ErrorBoundary>
      <ErrorComponent />
    </ErrorBoundary>
  )

  expect(screen.getByText('Component Error')).toBeInTheDocument()
})
```

### Recovery Testing
```tsx
const { result } = renderHook(() =>
  useAsyncWithRecovery(mockAsyncFn, { maxRetries: 2 })
)

act(() => {
  result.current.execute()
})

// Should retry automatically on failure
await waitFor(() => {
  expect(mockAsyncFn).toHaveBeenCalledTimes(3) // initial + 2 retries
})
```

## Production Deployment

### Environment Configuration
```bash
# .env.production
VITE_ERROR_REPORTING_URL=https://api.sentry.io/api/123/envelope/
VITE_APP_VERSION=1.2.3
```

### Monitoring Integration
```typescript
// Configure error reporting service
if (process.env.NODE_ENV === 'production') {
  // Sentry, LogRocket, Bugsnag, etc.
  errorLogger.configure({
    service: 'sentry',
    dsn: process.env.VITE_SENTRY_DSN,
    environment: 'production'
  })
}
```

## Troubleshooting

### Common Issues

1. **Error boundaries not catching errors**
   - Ensure ErrorBoundary wraps the component tree
   - Check for try/catch blocks that swallow errors

2. **Infinite retry loops**
   - Set appropriate maxRetries
   - Implement proper error detection

3. **Missing error context**
   - Always provide context props
   - Include timestamp in context

4. **Error reporting failures**
   - Check network connectivity
   - Verify service endpoint configuration

### Debug Mode
```tsx
// Enable verbose logging
if (process.env.NODE_ENV === 'development') {
  errorLogger.setLogLevel('debug')
}
```

This error boundary system provides robust error handling, recovery, and monitoring capabilities for production React applications.
