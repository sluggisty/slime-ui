# Enhanced API Error Handling Implementation

This document describes the comprehensive API error handling system implemented in the Slime UI application.

## Overview

The enhanced API error handling system provides:

- **Typed Error Classes**: Specific error types for different failure scenarios
- **Structured Error Responses**: Consistent error format with codes and context
- **Advanced Retry Logic**: Exponential backoff and configurable retry strategies
- **Timeout Handling**: Graceful timeout management with recovery
- **Rich Error Context**: Request metadata, timing, and user context
- **Error Recovery**: Intelligent retry mechanisms and fallback strategies
- **User-Friendly Messages**: Contextual error messages for better UX
- **Monitoring Integration**: Comprehensive error logging and reporting

## Error Class Hierarchy

### Base ApiError Class

```typescript
class ApiError extends Error {
  status?: number
  code?: string
  details?: any
  retryable: boolean
  timestamp: number
  context?: {
    url: string
    method: string
    userId?: string
    sessionId?: string
    requestId?: string
    duration?: number
  }
  category: string
}
```

### Specialized Error Classes

#### NetworkError
- **Status**: N/A (network-level failure)
- **Retryable**: Yes
- **Use Case**: Connection failures, DNS issues, offline state
- **User Message**: "Connection problem. Please check your internet connection and try again."

#### TimeoutError
- **Status**: 408
- **Retryable**: Yes
- **Use Case**: Request timeout after configured duration
- **User Message**: "The request took too long to complete. Please try again."

#### ValidationError
- **Status**: 422
- **Retryable**: No
- **Use Case**: Invalid input data, form validation failures
- **User Message**: "Please correct the errors in your input and try again."
- **Additional Features**:
  - Field-specific error tracking
  - Validation error aggregation

#### AuthenticationError
- **Status**: 401
- **Retryable**: No
- **Use Case**: Invalid or expired authentication tokens
- **User Message**: "Your session has expired. Please sign in again."
- **Side Effects**: Automatically clears auth state and redirects to login

#### AuthorizationError
- **Status**: 403
- **Retryable**: No
- **Use Case**: Insufficient permissions for requested action
- **User Message**: "You don't have permission to perform this action."

#### RateLimitError
- **Status**: 429
- **Retryable**: Yes (with backoff)
- **Use Case**: API rate limit exceeded
- **User Message**: "Too many requests. Please wait X seconds before trying again."
- **Additional Features**:
  - Reset time tracking
  - Automatic retry scheduling

#### ServerError
- **Status**: 5xx
- **Retryable**: Yes
- **Use Case**: Server-side failures, maintenance, overload
- **User Message**: "Our servers are experiencing issues. Please try again in a few moments."

## Error Factory Function

The `createApiError` function automatically determines the appropriate error type based on HTTP status and error characteristics:

```typescript
function createApiError(
  message: string,
  response?: Response,
  originalError?: Error | unknown,
  requestContext?: { url: string; method: string; duration?: number }
): ApiError
```

### Automatic Error Classification

| HTTP Status | Error Class | Retryable | Category |
|-------------|-------------|-----------|----------|
| 401 | AuthenticationError | No | client_error |
| 403 | AuthorizationError | No | client_error |
| 404 | ApiError | No | client_error |
| 408 | TimeoutError | Yes | client_error |
| 422 | ValidationError | No | client_error |
| 429 | RateLimitError | Yes | client_error |
| 4xx | ApiError | No | client_error |
| 5xx | ServerError | Yes | server_error |
| Network Error | NetworkError | Yes | network_error |

## Enhanced Retry Logic

### Configuration Options

```typescript
interface RequestOptions {
  retryConfig?: {
    maxRetries?: number
    retryDelay?: number
    retryableStatuses?: number[]
    exponentialBackoff?: boolean
  }
}
```

### Retry Strategies

#### Exponential Backoff
```typescript
const retryConfig = {
  maxRetries: 3,
  retryDelay: 1000, // Base delay in ms
  exponentialBackoff: true, // 1s, 2s, 4s delays
  retryableStatuses: [408, 429, 500, 502, 503, 504]
}
```

#### Linear Backoff
```typescript
const retryConfig = {
  maxRetries: 3,
  retryDelay: 1000, // Fixed delay
  exponentialBackoff: false, // 1s, 1s, 1s delays
}
```

### Retryable Conditions

Errors are retried if they meet ALL of the following criteria:

1. **Retryable Error Type**: Error class has `retryable = true`
2. **HTTP Status**: Status code is in `retryableStatuses` array
3. **Attempts Remaining**: Current attempt < `maxRetries`
4. **Not Rate Limited**: Rate limiter allows the request

### Default Retry Configuration

```typescript
const defaultRetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  exponentialBackoff: true
}
```

## Timeout Handling

### Timeout Configuration

```typescript
await fetchApi('/endpoint', {
  timeout: 10000, // 10 seconds
  retryConfig: {
    maxRetries: 2,
    retryDelay: 2000
  }
})
```

### Timeout Behavior

1. **AbortController**: Uses AbortController for clean cancellation
2. **TimeoutError**: Creates TimeoutError with timeout duration
3. **Automatic Retry**: Retries timeout errors if configured
4. **Exponential Backoff**: Increases delay for subsequent retries

## Error Context Enrichment

### Request Context

Every API error includes comprehensive request context:

```typescript
interface ApiError['context'] {
  url: string                    // Full request URL
  method: string                // HTTP method (GET, POST, etc.)
  userId?: string              // Current user ID
  sessionId?: string           // Session identifier
  requestId?: string           // Unique request ID
  duration?: number            // Request duration in ms
}
```

### Context Sources

- **URL**: From request configuration or response
- **Method**: From fetch options
- **User ID**: From auth context (when available)
- **Session ID**: Generated per session
- **Request ID**: Unique per request
- **Duration**: Calculated from request start to error

## Error Recovery Strategies

### Automatic Recovery

#### Network Failures
```typescript
// Automatic retry with exponential backoff
try {
  await fetchApi('/unstable-endpoint')
} catch (error) {
  if (error instanceof NetworkError && error.isRetryable()) {
    // Already retried automatically
    showUserMessage(error.getUserMessage())
  }
}
```

#### Rate Limiting
```typescript
try {
  await fetchApi('/rate-limited-endpoint')
} catch (error) {
  if (error instanceof RateLimitError) {
    // Automatic retry after reset time
    const waitSeconds = error.getSecondsUntilReset()
    scheduleRetry(waitSeconds * 1000)
  }
}
```

#### Server Errors
```typescript
try {
  await fetchApi('/server-endpoint')
} catch (error) {
  if (error instanceof ServerError) {
    // Retry with backoff for server issues
    showRetryButton()
  }
}
```

### Manual Recovery

```typescript
const { executeWithRecovery } = useErrorRecovery({
  maxRetries: 3,
  onRetry: (attempt) => {
    console.log(`Manual retry attempt ${attempt}`)
  }
})

const result = await executeWithRecovery(() =>
  fetchApi('/manual-retry-endpoint')
)
```

## User-Friendly Error Messages

### Contextual Messages

Error classes provide appropriate user messages based on error type:

```typescript
// Network issues
new NetworkError().getUserMessage()
// → "Connection problem. Please check your internet connection and try again."

// Authentication
new AuthenticationError().getUserMessage()
// → "Your session has expired. Please sign in again."

// Rate limiting
new RateLimitError('Rate limited', resetTime).getUserMessage()
// → "Too many requests. Please wait 30 seconds before trying again."
```

### Validation Errors

```typescript
const error = new ValidationError('Validation failed', {
  email: ['Invalid format'],
  password: ['Too short', 'Missing number']
})

error.getUserMessage()
// → "Please correct the errors in your input and try again."

error.getFieldErrors('password')
// → ['Too short', 'Missing number']
```

## Monitoring and Logging

### Error Reporting Integration

All API errors are automatically reported to the global error handler:

```typescript
// Automatic reporting
await errorHandler.handleNetworkError(error, url, method, status)
```

### Structured Error Logs

```typescript
interface ErrorReport {
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
    level: string
    category: string
    route?: string
    componentStack?: string
    method: string
    duration?: number
  }
  metadata: {
    appVersion: string
    environment: string
    buildId?: string
  }
}
```

### Analytics Integration

```typescript
// Track API errors in analytics
if (error instanceof ApiError) {
  analytics.track('api_error', {
    status: error.status,
    category: error.category,
    endpoint: error.context?.url,
    duration: error.context?.duration
  })
}
```

## Usage Examples

### Basic API Call with Error Handling

```typescript
try {
  const data = await fetchApi('/api/users')
  // Handle success
} catch (error) {
  if (error instanceof ApiError) {
    // Show user-friendly message
    showToast(error.getUserMessage(), 'error')

    // Log structured error
    console.error('API Error:', error.toJSON())
  }
}
```

### Custom Retry Configuration

```typescript
const data = await fetchApi('/api/unstable', {
  retryConfig: {
    maxRetries: 5,
    retryDelay: 2000,
    exponentialBackoff: true,
    retryableStatuses: [500, 502, 503, 504]
  }
})
```

### Validation Error Handling

```typescript
try {
  await fetchApi('/api/users', {
    method: 'POST',
    body: JSON.stringify(userData)
  })
} catch (error) {
  if (error instanceof ValidationError) {
    // Show field-specific errors
    error.getAllErrors().forEach(({ field, message }) => {
      setFieldError(field, message)
    })
  }
}
```

### Rate Limit Handling

```typescript
try {
  await fetchApi('/api/bulk-operation')
} catch (error) {
  if (error instanceof RateLimitError) {
    const waitTime = error.getSecondsUntilReset()

    showToast(
      `Please wait ${waitTime} seconds before trying again`,
      'warning'
    )

    // Schedule automatic retry
    setTimeout(() => {
      retryOperation()
    }, waitTime * 1000)
  }
}
```

## Configuration

### Environment Variables

```bash
# Error reporting
VITE_ERROR_REPORTING_URL=https://api.sentry.io/api/project-id/envelope

# API configuration
VITE_API_TIMEOUT=30000
VITE_API_RETRY_MAX_ATTEMPTS=3
VITE_API_RETRY_BASE_DELAY=1000

# Application metadata
VITE_APP_VERSION=1.2.3
VITE_BUILD_ID=abc123
```

### Runtime Configuration

```typescript
// Configure API client behavior
const apiConfig = {
  timeout: 30000,
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    exponentialBackoff: true
  }
}
```

## Testing

### Error Class Testing

```typescript
describe('ApiError Classes', () => {
  it('creates typed errors with proper context', () => {
    const error = new ValidationError('Invalid input', {
      email: ['Invalid format']
    })

    expect(error.status).toBe(422)
    expect(error.getFieldErrors('email')).toEqual(['Invalid format'])
  })
})
```

### API Client Testing

```typescript
describe('fetchApi Error Handling', () => {
  it('handles network errors with retry', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    mockFetch.mockResolvedValueOnce(successResponse)

    const result = await fetchApi('/test')
    expect(result).toEqual(expectedData)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('respects retry configuration', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(fetchApi('/test', {
      retryConfig: { maxRetries: 2 }
    })).rejects.toThrow(NetworkError)

    expect(mockFetch).toHaveBeenCalledTimes(3) // initial + 2 retries
  })
})
```

## Best Practices

### Error Handling Strategy

1. **Use Appropriate Error Types**: Leverage specific error classes for better handling
2. **Provide Rich Context**: Include request metadata for debugging
3. **Implement Retry Logic**: Use exponential backoff for transient failures
4. **Handle Timeouts Gracefully**: Configure appropriate timeout values
5. **Show User-Friendly Messages**: Use error.getUserMessage() for UI display
6. **Log Structured Errors**: Use error.toJSON() for logging
7. **Monitor Error Trends**: Track error rates and patterns

### Component Integration

```typescript
function ApiComponent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const handleApiCall = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await fetchApi('/api/data')
      // Handle success
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err)

        // Show user message
        showToast(err.getUserMessage(), 'error')

        // Log for debugging
        console.error('API Error:', err.toJSON())
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && (
        <div className="error-message">
          {error.getUserMessage()}
        </div>
      )}
      <button onClick={handleApiCall} disabled={loading}>
        {loading ? 'Loading...' : 'Fetch Data'}
      </button>
    </div>
  )
}
```

### Global Error Handling

```typescript
// In error handler setup
errorHandler.initialize()

// Handle all API errors globally
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason instanceof ApiError) {
    // Handle API promise rejections
    event.preventDefault()
    showGlobalError(event.reason)
  }
})
```

This enhanced API error handling system provides enterprise-grade error management with comprehensive recovery mechanisms, rich context, and excellent user experience for production applications.
