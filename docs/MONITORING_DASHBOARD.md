# Application Monitoring Dashboard Configuration

This document describes how to configure and use the application monitoring dashboard for the Slime UI application.

## Overview

The monitoring system provides comprehensive observability with:

- **Application Logging**: Structured logging with different severity levels
- **Performance Monitoring**: API response times, component render times
- **User Activity Tracking**: Page views, interactions, engagement metrics
- **Health Monitoring**: System health checks and endpoint monitoring
- **Error Tracking**: Comprehensive error logging and reporting

## Configuration

### Environment Variables

```bash
# Logging Configuration
VITE_LOGGING_ENDPOINT=https://api.your-logging-service.com/logs
VITE_LOG_LEVEL=info
VITE_LOG_MAX_BATCH_SIZE=10
VITE_LOG_FLUSH_INTERVAL=30000

# Error Reporting
VITE_ERROR_REPORTING_URL=https://api.sentry.io/api/project-id/envelope
VITE_ERROR_REPORTING_ENABLED=true

# Health Monitoring
VITE_HEALTH_CHECK_INTERVAL=60000
VITE_HEALTH_CHECK_TIMEOUT=10000

# Application Metadata
VITE_APP_VERSION=1.2.3
VITE_BUILD_ID=abc123
VITE_ENVIRONMENT=production
```

### Runtime Configuration

```typescript
// Configure logging
logger.updateConfig({
  level: LogLevel.DEBUG,
  enableExternal: true,
  externalEndpoint: 'https://api.datadog.com/api/v1/logs',
  sanitizeFields: ['password', 'token', 'api_key'],
  maxBatchSize: 20,
  flushInterval: 15000
})

// Configure health monitoring
healthMonitor.updateConfig({
  enabled: true,
  interval: 30000, // 30 seconds
  timeout: 5000,
  endpoints: [
    {
      name: 'api_health',
      url: 'https://api.yourapp.com/health',
      method: 'GET',
      expectedStatus: 200,
      critical: true
    },
    {
      name: 'database_health',
      url: 'https://api.yourapp.com/health/db',
      method: 'GET',
      expectedStatus: 200,
      critical: false
    }
  ]
})
```

## Logging System

### Log Levels

```typescript
enum LogLevel {
  DEBUG = 0,    // Detailed debugging information
  INFO = 1,     // General information messages
  WARN = 2,     // Warning messages
  ERROR = 3,    // Error messages
  FATAL = 4     // Critical error messages
}
```

### Structured Logging

```typescript
// Basic logging
logger.info('User logged in', {
  userId: 'user123',
  method: 'email'
})

// Error logging
logger.error('API request failed', error, {
  endpoint: '/api/users',
  status: 500
})

// Performance logging
logger.performance('api_response_time', 250, {
  endpoint: '/api/users',
  method: 'GET'
})
```

### User Activity Tracking

```typescript
// Page views
logger.trackPageView('/dashboard', {
  userId: 'user123',
  previousPage: '/login'
})

// User actions
logger.trackAction('button_click', {
  buttonId: 'save-settings',
  page: '/settings'
})

// Engagement metrics
logger.trackEngagement('form_completion', 85, {
  formId: 'user-registration',
  timeSpent: 120
})
```

## Performance Monitoring

### API Performance Tracking

```typescript
// Automatic API performance tracking
const response = await fetchApi('/api/users')
// Performance data automatically logged

// Manual performance measurement
const endTimer = logger.startTimer('complex_calculation')
// ... perform calculation
endTimer() // Automatically logs duration
```

### Component Performance

```typescript
import { useComponentPerformance } from './hooks/usePerformanceMonitoring'

function MyComponent() {
  useComponentPerformance('MyComponent')

  return <div>My Component</div>
  // Render time automatically tracked
}
```

### Custom Performance Metrics

```typescript
// Measure async operations
const result = await logger.measureAsync('data_processing', async () => {
  // Process data
  return processedData
})
```

## Health Monitoring

### Health Check Configuration

```typescript
// Add health check endpoints
healthMonitor.addEndpoint({
  name: 'api_health',
  url: 'https://api.yourapp.com/health',
  method: 'GET',
  expectedStatus: 200,
  critical: true,
  timeout: 5000
})

// Manual health check
const healthStatus = await healthMonitor.checkHealth()
console.log('System health:', healthStatus.overall)
```

### Health Status Structure

```typescript
interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: number
  checks: {
    [endpointName: string]: {
      status: 'pass' | 'fail' | 'warn'
      timestamp: number
      duration: number
      message?: string
      details?: any
      error?: Error
    }
  }
  version: string
  environment: string
}
```

## User Activity Tracking

### Page View Tracking

```typescript
import { useNavigationTracking } from './hooks/useUserActivity'

function App() {
  const { trackPageView } = useNavigationTracking()

  useEffect(() => {
    trackPageView(window.location.pathname)
  }, [])
}
```

### Interaction Tracking

```typescript
import { useUserActivity } from './hooks/useUserActivity'

function MyForm() {
  const { trackClick, trackFormInteraction } = useUserActivity()

  return (
    <form>
      <input
        onFocus={() => trackFormInteraction('user-form', 'email', 'focus')}
        onChange={() => trackFormInteraction('user-form', 'email', 'change')}
      />
      <button onClick={() => trackClick('submit-button')}>
        Submit
      </button>
    </form>
  )
}
```

### Engagement Metrics

```typescript
import { useEngagementTracking } from './hooks/useUserActivity'

function ProductFeature() {
  const { trackFeatureUsage, trackConversion } = useEngagementTracking()

  const handleFeatureUse = () => {
    trackFeatureUsage('advanced_search', 'filter_applied', {
      filterType: 'date_range'
    })
  }

  const handlePurchase = () => {
    trackConversion('product_purchase', 99.99, {
      productId: 'premium_plan',
      currency: 'USD'
    })
  }
}
```

## Monitoring Dashboard

### Health Dashboard Component

```tsx
import { HealthDashboard } from './components/HealthDashboard'

function AdminPage() {
  return (
    <div>
      <h1>System Monitoring</h1>
      <HealthDashboard />
    </div>
  )
}
```

### Custom Monitoring Views

```tsx
// Error rate monitoring
function ErrorRateChart() {
  const stats = errorLogger.getStats()

  return (
    <div>
      <h3>Error Rate: {stats.recent}/{stats.total}</h3>
      {/* Chart implementation */}
    </div>
  )
}

// Performance metrics
function PerformanceMetrics() {
  const { data, loading } = useApiPerformance()

  return (
    <div>
      <h3>API Performance</h3>
      {/* Performance charts */}
    </div>
  )
}
```

## Integration Examples

### Third-Party Services

#### Sentry Integration

```typescript
// Configure Sentry
Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay()
  ]
})

// Log to Sentry via our logger
logger.error('Sentry test error', new Error('Test error'))
```

#### DataDog Integration

```typescript
// Configure DataDog RUM
DD_RUM.init({
  applicationId: 'your-app-id',
  clientToken: 'your-client-token',
  site: 'datadoghq.com',
  service: 'slime-ui',
  env: process.env.NODE_ENV,
  version: process.env.VITE_APP_VERSION
})

// Performance data automatically sent to DataDog
```

#### Google Analytics

```typescript
// Configure Google Analytics
gtag('config', 'GA_MEASUREMENT_ID', {
  custom_map: {
    dimension1: 'user_id',
    dimension2: 'page_category'
  }
})

// Track events via our logger
logger.trackAction('purchase_complete', {
  transactionId: 'txn_123',
  value: 99.99
})
```

### Custom Monitoring Backend

```typescript
// Custom logging endpoint
const customLogger = {
  log: async (entries: StructuredLog[]) => {
    const response = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs: entries })
    })

    if (!response.ok) {
      console.error('Failed to send logs to custom backend')
    }
  }
}

// Configure logger to use custom backend
logger.updateConfig({
  externalEndpoint: '/api/logs'
})
```

## Alerting and Notifications

### Error Rate Alerting

```typescript
// Check error rates and alert
function checkErrorRates() {
  const stats = errorLogger.getStats()

  if (stats.recent > 10) { // More than 10 errors in time window
    // Send alert
    sendAlert('High error rate detected', {
      errorCount: stats.recent,
      timeWindow: 'last 24 hours'
    })
  }
}

// Run periodic checks
setInterval(checkErrorRates, 300000) // Every 5 minutes
```

### Performance Degradation Alerts

```typescript
// Monitor API performance
function checkApiPerformance() {
  const recentLogs = errorLogger.getLogs().filter(log =>
    log.context.action === 'api_call' &&
    Date.now() - log.context.timestamp < 3600000 // Last hour
  )

  const avgResponseTime = recentLogs.reduce((sum, log) =>
    sum + (log.context.duration || 0), 0
  ) / recentLogs.length

  if (avgResponseTime > 5000) { // Over 5 seconds average
    sendAlert('API performance degraded', {
      averageResponseTime: avgResponseTime,
      sampleSize: recentLogs.length
    })
  }
}
```

## Privacy and Security

### Data Sanitization

Sensitive data is automatically sanitized:

```typescript
logger.info('User login', {
  email: 'user@example.com',
  password: 'secret123', // Will be sanitized to '[REDACTED]'
  token: 'jwt.token.here' // Will be sanitized
})
```

### Custom Sanitization Rules

```typescript
logger.updateConfig({
  sanitizeFields: [
    'password',
    'token',
    'api_key',
    'credit_card',
    'ssn',
    'secret_field'
  ]
})
```

## Best Practices

### Logging Guidelines

1. **Use appropriate log levels**
   - `DEBUG`: Development debugging
   - `INFO`: Normal operations
   - `WARN`: Potential issues
   - `ERROR`: Application errors
   - `FATAL`: Critical failures

2. **Include relevant context**
   ```typescript
   logger.info('User action completed', {
     userId: 'user123',
     action: 'profile_update',
     success: true,
     duration: 250
   })
   ```

3. **Sanitize sensitive data**
   - Never log passwords, tokens, or PII
   - Use structured logging for better filtering

### Performance Monitoring

1. **Measure critical paths**
   ```typescript
   const endTimer = logger.startTimer('checkout_process')
   // Process checkout
   endTimer()
   ```

2. **Set performance budgets**
   ```typescript
   const API_TIMEOUT = 5000 // 5 seconds
   const PAGE_LOAD_BUDGET = 3000 // 3 seconds
   ```

3. **Monitor trends**
   - Track performance over time
   - Alert on degradation
   - A/B test improvements

### Health Monitoring

1. **Define critical endpoints**
   ```typescript
   healthMonitor.addEndpoint({
     name: 'payment_api',
     url: '/api/payments/health',
     critical: true // System unhealthy if this fails
   })
   ```

2. **Set appropriate timeouts**
   - Match your SLA requirements
   - Consider network conditions

3. **Monitor dependencies**
   - Database connections
   - External APIs
   - CDN availability

### User Activity Tracking

1. **Respect privacy**
   - Don't track sensitive user data
   - Provide opt-out mechanisms
   - Comply with privacy regulations

2. **Focus on valuable metrics**
   ```typescript
   // Good: Track feature usage
   trackFeatureUsage('search_filters', 'applied')

   // Avoid: Track personal information
   // DON'T: trackUserData('email', user.email)
   ```

3. **Balance data collection with performance**
   - Batch tracking calls
   - Use sampling for high-traffic events
   - Respect user preferences

## Troubleshooting

### Common Issues

1. **Logs not appearing**
   - Check `VITE_LOG_LEVEL` configuration
   - Verify external endpoint is accessible
   - Check browser network tab for failed requests

2. **Performance impact**
   - Monitor bundle size increase
   - Check for memory leaks in tracking
   - Use sampling for high-frequency events

3. **Privacy concerns**
   - Regularly audit logged data
   - Implement data retention policies
   - Provide user data export/deletion

4. **Alert fatigue**
   - Tune alert thresholds
   - Implement alert deduplication
   - Use severity levels appropriately

### Debug Mode

```typescript
// Enable debug logging
logger.updateConfig({
  level: LogLevel.DEBUG,
  enableConsole: true
})

// View current configuration
console.log('Logger config:', logger.getConfig())
```

This monitoring system provides comprehensive observability for production applications while maintaining performance and respecting user privacy.
