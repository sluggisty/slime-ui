import { errorLogger, ErrorLog, ErrorReport } from './errorLogger';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error categories for better classification
 */
export enum ErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  RUNTIME = 'runtime',
  RESOURCE = 'resource',
  THIRD_PARTY = 'third_party',
  UNKNOWN = 'unknown',
}

/**
 * Enhanced error context with additional metadata
 */
export interface EnhancedErrorContext {
  severity: ErrorSeverity;
  category: ErrorCategory;
  userId?: string;
  sessionId?: string;
  route?: string;
  userAgent?: string;
  timestamp: number;
  url?: string;
  componentStack?: string;
  retryCount?: number;
  userAction?: string;
  networkInfo?: {
    online: boolean;
    connection?: string;
    downlink?: number;
  };
  browserInfo?: {
    language: string;
    platform: string;
    cookieEnabled: boolean;
    onLine: boolean;
  };
  performanceInfo?: {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
    timing?: PerformanceTiming;
  };
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  enableGlobalHandlers: boolean;
  enableReporting: boolean;
  reportEndpoint?: string;
  reportTimeout: number;
  maxRetries: number;
  enableUserFeedback: boolean;
  environment: 'development' | 'staging' | 'production';
  appVersion?: string;
  buildId?: string;
}

/**
 * User-friendly error message
 */
export interface UserFriendlyMessage {
  title: string;
  message: string;
  action?: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
}

/**
 * Global Error Handler
 *
 * Centralized error handling system that manages:
 * - Global JavaScript errors
 * - Unhandled promise rejections
 * - React component errors (via Error Boundaries)
 * - Network errors
 * - Third-party service errors
 */
class ErrorHandler {
  private config: ErrorHandlerConfig;
  private isInitialized = false;
  private globalErrorListener?: (event: ErrorEvent) => void;
  private unhandledRejectionListener?: (event: PromiseRejectionEvent) => void;
  private userFeedbackQueue: UserFriendlyMessage[] = [];

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      enableGlobalHandlers: true,
      enableReporting: import.meta.env.PROD,
      reportEndpoint: import.meta.env.VITE_ERROR_REPORTING_URL,
      reportTimeout: 5000,
      maxRetries: 3,
      enableUserFeedback: true,
      environment: import.meta.env.PROD ? 'production' : 'development',
      appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
      buildId: import.meta.env.VITE_BUILD_ID,
      ...config,
    };
  }

  /**
   * Initialize the error handler
   */
  initialize(): void {
    if (this.isInitialized) return;

    if (this.config.enableGlobalHandlers && typeof window !== 'undefined') {
      this.setupGlobalErrorHandler();
      this.setupUnhandledRejectionHandler();
    }

    this.isInitialized = true;
    console.log('🚨 Error Handler initialized');
  }

  /**
   * Destroy the error handler and remove listeners
   */
  destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.globalErrorListener) {
        window.removeEventListener('error', this.globalErrorListener);
      }
      if (this.unhandledRejectionListener) {
        window.removeEventListener('unhandledrejection', this.unhandledRejectionListener);
      }
    }
    this.isInitialized = false;
    console.log('🧹 Error Handler destroyed');
  }

  /**
   * Handle any error with enhanced context
   */
  async handleError(
    error: Error | string,
    context?: Partial<EnhancedErrorContext>,
    source: 'javascript' | 'promise' | 'react' | 'network' | 'manual' = 'manual'
  ): Promise<void> {
    const enhancedError = this.normalizeError(error);
    const enhancedContext = this.enhanceContext(context || {}, source);

    // Determine severity and category
    const { severity, category } = this.classifyError(enhancedError, enhancedContext);

    enhancedContext.severity = severity;
    enhancedContext.category = category;

    // Log the error
    const errorLog = errorLogger.logError(enhancedError, undefined, enhancedContext, severity);

    // Report to external service if enabled
    if (this.config.enableReporting) {
      try {
        await this.reportError(enhancedError, enhancedContext);
      } catch (reportError) {
        console.warn('Failed to report error:', reportError);
      }
    }

    // Add to user feedback queue if enabled
    if (this.config.enableUserFeedback) {
      const userMessage = this.createUserFriendlyMessage(enhancedError, enhancedContext);
      if (userMessage) {
        this.userFeedbackQueue.push(userMessage);
      }
    }

    // Trigger any additional error handling (analytics, monitoring, etc.)
    this.triggerErrorHooks(enhancedError, enhancedContext, errorLog);
  }

  /**
   * Handle network errors specifically
   */
  async handleNetworkError(
    error: Error,
    url?: string,
    method?: string,
    status?: number,
    response?: any
  ): Promise<void> {
    const context: Partial<EnhancedErrorContext> = {
      category: ErrorCategory.NETWORK,
      url,
      userAction: `${method?.toUpperCase() || 'GET'} ${url}`,
      networkInfo: this.getNetworkInfo(),
      severity: status && status >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
    };

    if (status) {
      (error as any).status = status(error as any).response = response;
    }

    await this.handleError(error, context, 'network');
  }

  /**
   * Handle authentication errors
   */
  async handleAuthError(error: Error, context?: Partial<EnhancedErrorContext>): Promise<void> {
    const enhancedContext: Partial<EnhancedErrorContext> = {
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.HIGH,
      ...context,
    };

    await this.handleError(error, enhancedContext, 'network');
  }

  /**
   * Get user-friendly messages for display
   */
  getUserMessages(): UserFriendlyMessage[] {
    return [...this.userFeedbackQueue];
  }

  /**
   * Clear user feedback queue
   */
  clearUserMessages(): void {
    this.userFeedbackQueue = [];
  }

  /**
   * Get the next user message and remove it from queue
   */
  popUserMessage(): UserFriendlyMessage | undefined {
    return this.userFeedbackQueue.shift();
  }

  /**
   * Get error statistics
   */
  getStats() {
    const logs = errorLogger.getLogs();
    const recentLogs = logs.filter(log => Date.now() - log.timestamp < 24 * 60 * 60 * 1000); // Last 24 hours

    return {
      total: logs.length,
      recent: recentLogs.length,
      bySeverity: {
        [ErrorSeverity.LOW]: recentLogs.filter(log => log.level === 'info').length,
        [ErrorSeverity.MEDIUM]: recentLogs.filter(log => log.level === 'warning').length,
        [ErrorSeverity.HIGH]: recentLogs.filter(log => log.level === 'error').length,
        [ErrorSeverity.CRITICAL]: 0, // Would need additional logic to determine critical errors
      },
      byCategory: Object.values(ErrorCategory).reduce(
        (acc, category) => {
          acc[category] = recentLogs.filter(
            log => (log.context as any)?.category === category
          ).length;
          return acc;
        },
        {} as Record<ErrorCategory, number>
      ),
    };
  }

  /**
   * Setup global JavaScript error handler
   */
  private setupGlobalErrorHandler(): void {
    this.globalErrorListener = (event: ErrorEvent) => {
      // Prevent duplicate handling if React error boundary already caught it
      if (event.error && event.error.message?.includes('React Error Boundary')) {
        return;
      }

      const error = event.error || new Error(event.message);
      const context: Partial<EnhancedErrorContext> = {
        url: event.filename,
        userAction: `Line ${event.lineno}:${event.colno}`,
        componentStack: event.filename
          ? `${event.filename}:${event.lineno}:${event.colno}`
          : undefined,
      };

      this.handleError(error, context, 'javascript');
    };

    window.addEventListener('error', this.globalErrorListener);
  }

  /**
   * Setup unhandled promise rejection handler
   */
  private setupUnhandledRejectionHandler(): void {
    this.unhandledRejectionListener = (event: PromiseRejectionEvent) => {
      const error =
        event.reason instanceof Error
          ? event.reason
          : new Error(`Unhandled promise rejection: ${String(event.reason)}`);

      const context: Partial<EnhancedErrorContext> = {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.RUNTIME,
        userAction: 'async_operation',
      };

      this.handleError(error, context, 'promise');

      // Prevent the default browser behavior (logging to console)
      event.preventDefault();
    };

    window.addEventListener('unhandledrejection', this.unhandledRejectionListener);
  }

  /**
   * Normalize error to Error instance
   */
  private normalizeError(error: Error | string): Error {
    if (error instanceof Error) {
      return error;
    }

    // Create a new Error with the string message
    const normalizedError = new Error(typeof error === 'string' ? error : 'Unknown error');
    normalizedError.name = 'ErrorHandlerError';
    return normalizedError;
  }

  /**
   * Enhance error context with additional information
   */
  private enhanceContext(
    context: Partial<EnhancedErrorContext>,
    source: string
  ): EnhancedErrorContext {
    const enhanced: EnhancedErrorContext = {
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.UNKNOWN,
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      sessionId: this.getSessionId(),
      userId: this.getCurrentUserId(),
      route: this.getCurrentRoute(),
      networkInfo: this.getNetworkInfo(),
      browserInfo: this.getBrowserInfo(),
      performanceInfo: this.getPerformanceInfo(),
      ...context,
    };

    return enhanced;
  }

  /**
   * Classify error severity and category
   */
  private classifyError(
    error: Error,
    context: Partial<EnhancedErrorContext>
  ): { severity: ErrorSeverity; category: ErrorCategory } {
    let severity = ErrorSeverity.MEDIUM;
    let category = ErrorCategory.UNKNOWN;

    // Check error message patterns
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes('fetch') ||
      message.includes('network') ||
      message.includes('connection')
    ) {
      category = ErrorCategory.NETWORK;
      severity = message.includes('timeout') ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
    }

    // Authentication errors
    if (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('auth')
    ) {
      category = ErrorCategory.AUTHENTICATION;
      severity = ErrorSeverity.HIGH;
    }

    // Validation errors
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required')
    ) {
      category = ErrorCategory.VALIDATION;
      severity = ErrorSeverity.LOW;
    }

    // Runtime errors
    if (
      message.includes('cannot read') ||
      message.includes('undefined') ||
      message.includes('null')
    ) {
      category = ErrorCategory.RUNTIME;
      severity = ErrorSeverity.HIGH;
    }

    // Check HTTP status if available
    const status = (error as any).status;
    if (status) {
      if (status >= 500) {
        severity = ErrorSeverity.CRITICAL;
        category = ErrorCategory.THIRD_PARTY;
      } else if (status >= 400) {
        severity = ErrorSeverity.HIGH;
        if (status === 401 || status === 403) {
          category = ErrorCategory.AUTHENTICATION;
        } else if (status === 422) {
          category = ErrorCategory.VALIDATION;
        }
      }
    }

    // Override with context if provided
    if (context.severity) severity = context.severity;
    if (context.category) category = context.category;

    return { severity, category };
  }

  /**
   * Report error to external service
   */
  private async reportError(error: Error, context: EnhancedErrorContext): Promise<void> {
    if (!this.config.reportEndpoint) {
      console.warn('Error reporting endpoint not configured');
      return;
    }

    const errorReport: ErrorReport = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context: {
        timestamp: context.timestamp,
        url: context.url || '',
        userAgent: context.userAgent || '',
        sessionId: context.sessionId,
        userId: context.userId,
        level: context.severity,
        retryCount: context.retryCount,
        route: context.route,
        componentStack: context.componentStack,
      },
      metadata: {
        appVersion: this.config.appVersion || '1.0.0',
        environment: this.config.environment,
        buildId: this.config.buildId,
      },
    };

    // Add additional context
    (errorReport.context as any).category = context.category;
    (errorReport.context as any).userAction = context.userAction;
    (errorReport.context as any).networkInfo = context.networkInfo;
    (errorReport.context as any).browserInfo = context.browserInfo;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.reportTimeout);

    try {
      const response = await fetch(this.config.reportEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorReport),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('✅ Error report sent successfully');
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') {
        console.warn('Error report timed out');
      } else {
        throw fetchError;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Create user-friendly error message
   */
  private createUserFriendlyMessage(
    error: Error,
    context: EnhancedErrorContext
  ): UserFriendlyMessage | null {
    const { severity, category } = context;

    // Don't show user messages for low severity errors in production
    if (severity === ErrorSeverity.LOW && this.config.environment === 'production') {
      return null;
    }

    // Create appropriate messages based on category and severity
    switch (category) {
      case ErrorCategory.NETWORK:
        return {
          title: 'Connection Problem',
          message:
            'Unable to connect to our servers. Please check your internet connection and try again.',
          action: 'Retry',
          severity,
          category,
        };

      case ErrorCategory.AUTHENTICATION:
        return {
          title: 'Authentication Required',
          message: 'Your session has expired. Please sign in again.',
          action: 'Sign In',
          severity,
          category,
        };

      case ErrorCategory.VALIDATION:
        return {
          title: 'Invalid Input',
          message: 'Please check your input and try again.',
          severity,
          category,
        };

      case ErrorCategory.RUNTIME:
        if (severity === ErrorSeverity.CRITICAL) {
          return {
            title: 'Application Error',
            message: 'Something went wrong. The page will reload to fix the issue.',
            action: 'Reload',
            severity,
            category,
          };
        }
        return {
          title: 'Unexpected Error',
          message: 'An unexpected error occurred. Please try refreshing the page.',
          action: 'Refresh',
          severity,
          category,
        };

      default:
        return {
          title: 'Something went wrong',
          message: 'We encountered an unexpected error. Our team has been notified.',
          severity,
          category,
        };
    }
  }

  /**
   * Trigger additional error handling hooks
   */
  private triggerErrorHooks(error: Error, context: EnhancedErrorContext, errorLog: string): void {
    // Send to analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'exception', {
        description: error.message,
        fatal: context.severity === ErrorSeverity.CRITICAL,
        custom_map: {
          category: context.category,
          severity: context.severity,
        },
      });
    }

    // Send to monitoring service
    if (typeof window !== 'undefined' && (window as any)._paq) {
      // Matomo/Piwik
      (window as any)._paq.push(['trackEvent', 'Error', context.category, error.message]);
    }

    // Log to development console with enhanced information
    if (this.config.environment === 'development') {
      console.group(`🚨 [${context.severity.toUpperCase()}] ${context.category}`);
      console.error('Error:', error);
      console.log('Context:', context);
      console.log('Log ID:', errorLog);
      console.groupEnd();
    }
  }

  /**
   * Get current user ID
   */
  private getCurrentUserId(): string | undefined {
    // This would integrate with your auth system
    return undefined;
  }

  /**
   * Get current route
   */
  private getCurrentRoute(): string | undefined {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return undefined;
  }

  /**
   * Get session ID
   */
  private getSessionId(): string | undefined {
    if (typeof window !== 'undefined') {
      let sessionId = sessionStorage.getItem('error_session_id');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('error_session_id', sessionId);
      }
      return sessionId;
    }
    return undefined;
  }

  /**
   * Get network information
   */
  private getNetworkInfo() {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      return {
        online: navigator.onLine,
        connection: connection?.effectiveType,
        downlink: connection?.downlink,
      };
    }

    return {
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    };
  }

  /**
   * Get browser information
   */
  private getBrowserInfo() {
    if (typeof navigator !== 'undefined') {
      return {
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
      };
    }
    return undefined;
  }

  /**
   * Get performance information
   */
  private getPerformanceInfo() {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      return {
        memory: (performance as any).memory,
        timing: performance.timing,
      };
    }
    return undefined;
  }
}

// Create error handler instance with safe initialization
let errorHandlerInstance: ErrorHandler;

try {
  errorHandlerInstance = new ErrorHandler();
} catch (error) {
  // Fallback configuration if import.meta.env is not available
  console.warn('Error handler initialization failed, using fallback config:', error);
  errorHandlerInstance = new ErrorHandler({
    enableGlobalHandlers: false,
    enableReporting: false,
  });
}

export const errorHandler = errorHandlerInstance;

// Convenience functions
export const handleError = (error: Error | string, context?: Partial<EnhancedErrorContext>) =>
  errorHandler.handleError(error, context);

export const handleNetworkError = (
  error: Error,
  url?: string,
  method?: string,
  status?: number,
  response?: any
) => errorHandler.handleNetworkError(error, url, method, status, response);

export const handleAuthError = (error: Error, context?: Partial<EnhancedErrorContext>) =>
  errorHandler.handleAuthError(error, context);

export default errorHandler;
