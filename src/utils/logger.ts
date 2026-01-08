/**
 * Application Monitoring and Logging System
 *
 * Provides comprehensive logging, performance monitoring, and user activity tracking
 * for production-ready applications.
 */

import { errorHandler } from './errorHandler';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogContext {
  userId?: string;
  sessionId?: string;
  route?: string;
  component?: string;
  action?: string;
  timestamp: number;
  duration?: number;
  userAgent?: string;
  url?: string;
  ip?: string;
  correlationId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context: LogContext;
  data?: any;
  error?: Error;
  stack?: string;
}

export interface StructuredLog {
  timestamp: string;
  level: string;
  message: string;
  context: LogContext;
  data?: any;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  environment: string;
  version: string;
  service: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableExternal: boolean;
  externalEndpoint?: string;
  sanitizeFields: string[];
  maxBatchSize: number;
  flushInterval: number;
  enablePerformanceMonitoring: boolean;
  enableUserTracking: boolean;
  environment: 'development' | 'staging' | 'production';
  serviceName: string;
  version: string;
}

// ============================================================================
// SENSITIVE DATA SANITIZATION
// ============================================================================

/**
 * Fields that should be sanitized in logs
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'api_key',
  'secret',
  'key',
  'auth',
  'authorization',
  'bearer',
  'credentials',
  'private_key',
  'access_token',
  'refresh_token',
  'session_token',
  'csrf_token',
  'x-api-key',
  'x-auth-token',
  'cookie',
  'authorization',
  'credit_card',
  'ssn',
  'social_security',
  'bank_account',
  'routing_number',
];

/**
 * Sanitize sensitive data from objects
 */
function sanitizeData(data: any, additionalFields: string[] = []): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [...SENSITIVE_FIELDS, ...additionalFields];
  const sanitized = Array.isArray(data) ? [...data] : { ...data };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  // Recursively sanitize nested objects
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value, additionalFields);
    }
  }

  return sanitized;
}

/**
 * Sanitize error stack traces to remove sensitive information
 */
function sanitizeStackTrace(stack: string): string {
  if (!stack) return stack;

  // Remove file paths that might contain sensitive information
  return stack
    .replace(/file:\/\/[^\s)]+/g, 'file://[REDACTED]')
    .replace(/\/Users\/[^\/\s)]+\/[^\/\s)]+/g, '/Users/[REDACTED]/[REDACTED]')
    .replace(/\/home\/[^\/\s)]+\/[^\/\s)]+/g, '/home/[REDACTED]/[REDACTED]')
    .replace(/C:\\Users\\[^\\\s)]+\\[^\\\s)]+/g, 'C:\\Users\\[REDACTED]\\[REDACTED]');
}

// ============================================================================
// LOGGER CLASS
// ============================================================================

class Logger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private sessionId: string;
  private correlationId: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableExternal: import.meta.env.PROD,
      externalEndpoint: import.meta.env.VITE_LOGGING_ENDPOINT,
      sanitizeFields: [],
      maxBatchSize: 10,
      flushInterval: 30000, // 30 seconds
      enablePerformanceMonitoring: true,
      enableUserTracking: true,
      environment: import.meta.env.PROD ? 'production' : 'development',
      serviceName: 'slime-ui',
      version: import.meta.env.VITE_APP_VERSION || '1.0.0',
      ...config,
    };

    this.sessionId = this.generateSessionId();
    this.correlationId = this.generateCorrelationId();

    this.startFlushTimer();
  }

  /**
   * Initialize the logger
   */
  initialize(): void {
    if (this.config.enablePerformanceMonitoring) {
      this.setupPerformanceMonitoring();
    }

    if (this.config.enableUserTracking) {
      this.setupUserTracking();
    }

    this.info('Logger initialized', {
      config: {
        level: LogLevel[this.config.level],
        environment: this.config.environment,
        serviceName: this.config.serviceName,
      },
    });
  }

  /**
   * Destroy the logger and flush remaining logs
   */
  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    await this.flush();
    this.info('Logger destroyed');
  }

  // ============================================================================
  // LOGGING METHODS
  // ============================================================================

  /**
   * Log debug message
   */
  debug(message: string, context?: Partial<LogContext>, data?: any): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Partial<LogContext>, data?: any): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Partial<LogContext>, data?: any): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: Partial<LogContext>, data?: any): void {
    this.log(LogLevel.ERROR, message, context, data, error);
  }

  /**
   * Log fatal error message
   */
  fatal(message: string, error?: Error, context?: Partial<LogContext>, data?: any): void {
    this.log(LogLevel.FATAL, message, context, data, error);
  }

  // ============================================================================
  // PERFORMANCE MONITORING
  // ============================================================================

  /**
   * Start performance measurement
   */
  startTimer(name: string, context?: Partial<LogContext>): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.performance(name, duration, context);
    };
  }

  /**
   * Log performance metric
   */
  performance(name: string, duration: number, context?: Partial<LogContext>, data?: any): void {
    this.info(
      `Performance: ${name}`,
      {
        ...context,
        action: 'performance_measurement',
        duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
        metric: name,
      },
      data
    );
  }

  /**
   * Measure async function performance
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    context?: Partial<LogContext>
  ): Promise<T> {
    const startTime = performance.now();

    try {
      const result = await fn();
      const duration = performance.now() - startTime;

      this.performance(`${name}_success`, duration, context);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.performance(`${name}_error`, duration, { ...context, error: (error as Error).message });
      throw error;
    }
  }

  // ============================================================================
  // USER ACTIVITY TRACKING
  // ============================================================================

  /**
   * Track user action
   */
  trackAction(action: string, context?: Partial<LogContext>, data?: any): void {
    this.info(
      `User Action: ${action}`,
      {
        ...context,
        action,
        category: 'user_interaction',
      },
      data
    );
  }

  /**
   * Track page view
   */
  trackPageView(path: string, context?: Partial<LogContext>): void {
    this.info(`Page View: ${path}`, {
      ...context,
      route: path,
      action: 'page_view',
      category: 'navigation',
    });
  }

  /**
   * Track user engagement
   */
  trackEngagement(event: string, value?: number, context?: Partial<LogContext>): void {
    this.info(`Engagement: ${event}`, {
      ...context,
      action: 'engagement',
      category: 'user_engagement',
      engagement_event: event,
      engagement_value: value,
    });
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Partial<LogContext>,
    data?: any,
    error?: Error
  ): void {
    // Check if we should log this level
    if (level < this.config.level) {
      return;
    }

    const logEntry: LogEntry = {
      level,
      message,
      context: this.buildContext(context),
      data: data ? sanitizeData(data, this.config.sanitizeFields) : undefined,
      error,
      stack: error?.stack ? sanitizeStackTrace(error.stack) : undefined,
    };

    // Add to buffer
    this.logBuffer.push(logEntry);

    // Immediate console logging for development
    if (this.config.enableConsole) {
      this.logToConsole(logEntry);
    }

    // Flush if buffer is full
    if (this.logBuffer.length >= this.config.maxBatchSize) {
      this.flush();
    }

    // Handle errors through error handler
    if (level >= LogLevel.ERROR && error) {
      errorHandler
        .handleError(error, {
          severity: level === LogLevel.FATAL ? 'critical' : 'high',
          category: 'runtime',
          ...logEntry.context,
        })
        .catch(console.error);
    }
  }

  /**
   * Build complete log context
   */
  private buildContext(partialContext?: Partial<LogContext>): LogContext {
    const context: LogContext = {
      timestamp: Date.now(),
      sessionId: this.sessionId,
      correlationId: this.correlationId,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      ...partialContext,
    };

    // Add user ID if available (would integrate with auth system)
    // context.userId = getCurrentUserId()

    return context;
  }

  /**
   * Log to console with appropriate formatting
   */
  private logToConsole(entry: LogEntry): void {
    const levelName = LogLevel[entry.level];
    const timestamp = new Date(entry.context.timestamp).toISOString();
    const prefix = `[${timestamp}] ${levelName}:`;

    const logData = {
      message: entry.message,
      context: entry.context,
      data: entry.data,
      ...(entry.error && { error: entry.error }),
    };

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(prefix, logData);
        break;
      case LogLevel.INFO:
        console.info(prefix, logData);
        break;
      case LogLevel.WARN:
        console.warn(prefix, logData);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(prefix, logData);
        break;
    }
  }

  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    if (typeof window === 'undefined' || !window.performance) return;

    // Monitor page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType(
          'navigation'
        )[0] as PerformanceNavigationTiming;
        if (navigation) {
          this.performance('page_load', navigation.loadEventEnd - navigation.fetchStart, {
            route: window.location.pathname,
            action: 'page_load_complete',
          });
        }
      }, 0);
    });

    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              // Tasks longer than 50ms
              this.warn('Long task detected', {
                action: 'long_task',
                duration: entry.duration,
                startTime: entry.startTime,
              });
            }
          }
        });

        observer.observe({ entryTypes: ['longtask'] });
      } catch (error) {
        // Performance observer not supported or failed
      }
    }
  }

  /**
   * Setup user activity tracking
   */
  private setupUserTracking(): void {
    if (typeof window === 'undefined') return;

    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.trackEngagement(document.hidden ? 'page_hidden' : 'page_visible', undefined, {
        route: window.location.pathname,
      });
    });

    // Track route changes (basic implementation)
    let currentPath = window.location.pathname;
    const observer = new MutationObserver(() => {
      const newPath = window.location.pathname;
      if (newPath !== currentPath) {
        this.trackPageView(newPath);
        currentPath = newPath;
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Track errors
    window.addEventListener('error', event => {
      this.error(
        'JavaScript error',
        event.error,
        {
          route: window.location.pathname,
          action: 'javascript_error',
          component: 'global',
        },
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        }
      );
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', event => {
      this.error('Unhandled promise rejection', event.reason, {
        route: window.location.pathname,
        action: 'unhandled_promise_rejection',
      });
    });
  }

  /**
   * Flush log buffer to external service
   */
  private async flush(): Promise<void> {
    if (
      this.logBuffer.length === 0 ||
      !this.config.enableExternal ||
      !this.config.externalEndpoint
    ) {
      return;
    }

    const logsToSend = this.logBuffer.splice(0);
    const structuredLogs: StructuredLog[] = logsToSend.map(entry => ({
      timestamp: new Date(entry.context.timestamp).toISOString(),
      level: LogLevel[entry.level],
      message: entry.message,
      context: entry.context,
      data: entry.data,
      ...(entry.error && {
        error: {
          name: entry.error.name,
          message: entry.error.message,
          stack: entry.stack,
        },
      }),
      environment: this.config.environment,
      version: this.config.version,
      service: this.config.serviceName,
    }));

    try {
      const response = await fetch(this.config.externalEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: structuredLogs }),
      });

      if (!response.ok) {
        console.warn('Failed to send logs to external service:', response.statusText);
        // Put logs back in buffer for retry
        this.logBuffer.unshift(...logsToSend);
      }
    } catch (error) {
      console.warn('Error sending logs to external service:', error);
      // Put logs back in buffer for retry
      this.logBuffer.unshift(...logsToSend);
    }
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    if (this.config.enableExternal && this.config.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    if (typeof sessionStorage !== 'undefined') {
      let sessionId = sessionStorage.getItem('logger_session_id');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('logger_session_id', sessionId);
      }
      return sessionId;
    }
    return `server_${Date.now()}`;
  }

  /**
   * Generate correlation ID for request tracing
   */
  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// GLOBAL LOGGER INSTANCE
// ============================================================================

export const logger = new Logger();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export const log = {
  debug: (message: string, context?: Partial<LogContext>, data?: any) =>
    logger.debug(message, context, data),
  info: (message: string, context?: Partial<LogContext>, data?: any) =>
    logger.info(message, context, data),
  warn: (message: string, context?: Partial<LogContext>, data?: any) =>
    logger.warn(message, context, data),
  error: (message: string, error?: Error, context?: Partial<LogContext>, data?: any) =>
    logger.error(message, error, context, data),
  fatal: (message: string, error?: Error, context?: Partial<LogContext>, data?: any) =>
    logger.fatal(message, error, context, data),
};

// ============================================================================
// PERFORMANCE MONITORING HOOKS
// ============================================================================

/**
 * React hook for performance monitoring
 */
export function usePerformanceMonitoring() {
  const startTimer = (name: string, context?: Partial<LogContext>) =>
    logger.startTimer(name, context);

  const measureAsync = <T>(name: string, fn: () => Promise<T>, context?: Partial<LogContext>) =>
    logger.measureAsync(name, fn, context);

  return { startTimer, measureAsync };
}

/**
 * React hook for user activity tracking
 */
export function useActivityTracking() {
  const trackAction = (action: string, context?: Partial<LogContext>, data?: any) =>
    logger.trackAction(action, context, data);

  const trackPageView = (path: string, context?: Partial<LogContext>) =>
    logger.trackPageView(path, context);

  const trackEngagement = (event: string, value?: number, context?: Partial<LogContext>) =>
    logger.trackEngagement(event, value, context);

  return { trackAction, trackPageView, trackEngagement };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { LogContext, LogEntry, StructuredLog, LoggerConfig };
export default logger;
