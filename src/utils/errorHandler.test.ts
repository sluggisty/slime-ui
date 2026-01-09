import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { errorHandler, ErrorSeverity, ErrorCategory } from './errorHandler';
import { errorLogger } from './errorLogger';

// Mock the error logger
vi.mock('./errorLogger', () => ({
  errorLogger: {
    logError: vi.fn(),
    reportError: vi.fn().mockResolvedValue(true),
    getStats: vi.fn().mockReturnValue({
      total: 0,
      recent: 0,
      bySeverity: {},
      byCategory: {},
    }),
    getUserMessages: vi.fn().mockReturnValue([]),
    clearUserMessages: vi.fn(),
  },
}));

// Mock fetch for error reporting
global.fetch = vi.fn();

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset error handler state
    errorHandler['isInitialized'] = false;
    errorHandler['userFeedbackQueue'] = [];
  });

  afterEach(() => {
    // Clean up event listeners
    if (errorHandler['globalErrorListener']) {
      window.removeEventListener('error', errorHandler['globalErrorListener']);
    }
    if (errorHandler['unhandledRejectionListener']) {
      window.removeEventListener('unhandledrejection', errorHandler['unhandledRejectionListener']);
    }
  });

  describe('Initialization', () => {
    it('initializes the error handler', () => {
      errorHandler.initialize();
      expect(errorHandler['isInitialized']).toBe(true);
    });

    it('destroys the error handler', () => {
      errorHandler.initialize();
      errorHandler.destroy();
      expect(errorHandler['isInitialized']).toBe(false);
    });
  });

  describe('Error Classification', () => {
    it('classifies network errors correctly', () => {
      const error = new Error('Failed to fetch');
      const context = errorHandler['classifyError'](error, {});

      expect(context.category).toBe(ErrorCategory.NETWORK);
      expect(context.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('classifies auth errors correctly', () => {
      const error = new Error('Unauthorized');
      const context = errorHandler['classifyError'](error, {});

      expect(context.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(context.severity).toBe(ErrorSeverity.HIGH);
    });

    it('classifies validation errors correctly', () => {
      const error = new Error('Validation failed');
      const context = errorHandler['classifyError'](error, {});

      expect(context.category).toBe(ErrorCategory.VALIDATION);
      expect(context.severity).toBe(ErrorSeverity.LOW);
    });

    it('classifies runtime errors correctly', () => {
      const error = new Error('Cannot read property of undefined');
      const context = errorHandler['classifyError'](error, {});

      expect(context.category).toBe(ErrorCategory.RUNTIME);
      expect(context.severity).toBe(ErrorSeverity.HIGH);
    });

    it('uses provided context over classification', () => {
      const error = new Error('Some error');
      const context = errorHandler['classifyError'](error, {
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.THIRD_PARTY,
      });

      expect(context.severity).toBe(ErrorSeverity.CRITICAL);
      expect(context.category).toBe(ErrorCategory.THIRD_PARTY);
    });
  });

  describe('Error Handling', () => {
    it('handles errors with enhanced context', async () => {
      const error = new Error('Test error');

      await errorHandler.handleError(error, {
        category: ErrorCategory.RUNTIME,
        severity: ErrorSeverity.HIGH,
      });

      expect(errorLogger.logError).toHaveBeenCalledWith(
        error,
        undefined,
        expect.objectContaining({
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.RUNTIME,
          timestamp: expect.any(Number),
        }),
        ErrorSeverity.HIGH
      );
    });

    it('handles network errors specifically', async () => {
      const error = new Error('Network error');

      await errorHandler.handleNetworkError(error, '/api/test', 'GET', 500);

      expect(errorLogger.logError).toHaveBeenCalledWith(
        expect.any(Error),
        undefined,
        expect.objectContaining({
          category: ErrorCategory.NETWORK,
          severity: ErrorSeverity.HIGH,
          url: '/api/test',
          userAction: 'GET /api/test',
        }),
        ErrorSeverity.HIGH
      );
    });

    it('handles auth errors specifically', async () => {
      const error = new Error('Auth error');

      await errorHandler.handleAuthError(error);

      expect(errorLogger.logError).toHaveBeenCalledWith(
        error,
        undefined,
        expect.objectContaining({
          category: ErrorCategory.AUTHENTICATION,
          severity: ErrorSeverity.HIGH,
        }),
        ErrorSeverity.HIGH
      );
    });
  });

  describe('Error Reporting', () => {
    it('reports errors when enabled', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;

      const error = new Error('Test error');

      await errorHandler.handleError(error);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        })
      );
    });

    it('handles reporting timeouts', async () => {
      const mockFetch = vi.fn(
        () => new Promise(resolve => setTimeout(() => resolve({ ok: true }), 100))
      );
      global.fetch = mockFetch;

      // Set short timeout
      errorHandler['config'].reportTimeout = 50;

      const error = new Error('Test error');
      await errorHandler.handleError(error);

      // Should still work despite timeout
      expect(errorLogger.logError).toHaveBeenCalled();
    });
  });

  describe('User Feedback', () => {
    it('creates user-friendly messages for errors', async () => {
      const error = new Error('Network error');

      await errorHandler.handleError(error, { category: ErrorCategory.NETWORK });

      const messages = errorHandler.getUserMessages();
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toHaveProperty('title');
      expect(messages[0]).toHaveProperty('message');
    });

    it('manages user feedback queue', async () => {
      const error = new Error('Test error');
      await errorHandler.handleError(error);

      expect(errorHandler.getUserMessages().length).toBeGreaterThan(0);

      errorHandler.clearUserMessages();
      expect(errorHandler.getUserMessages().length).toBe(0);
    });
  });

  describe('Global Error Handlers', () => {
    it('sets up global error handlers on initialization', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      errorHandler.initialize();

      expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });

    it('handles JavaScript errors globally', () => {
      errorHandler.initialize();

      const errorEvent = new ErrorEvent('error', {
        message: 'Global error',
        filename: 'test.js',
        lineno: 10,
        colno: 5,
      });

      // Trigger the global error handler
      window.dispatchEvent(errorEvent);

      expect(errorLogger.logError).toHaveBeenCalled();
    });

    it('handles unhandled promise rejections', () => {
      errorHandler.initialize();

      const rejectionEvent = new PromiseRejectionEvent('unhandledrejection', {
        reason: new Error('Unhandled promise rejection'),
      });

      // Trigger the unhandled rejection handler
      window.dispatchEvent(rejectionEvent);

      expect(errorLogger.logError).toHaveBeenCalled();
    });
  });

  describe('Error Statistics', () => {
    it('provides error statistics', () => {
      const stats = errorHandler.getStats();

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('recent');
      expect(stats).toHaveProperty('bySeverity');
      expect(stats).toHaveProperty('byCategory');
    });
  });

  describe('Context Enhancement', () => {
    it('enhances error context with browser information', () => {
      const context = errorHandler['enhanceContext']({}, 'manual');

      expect(context).toHaveProperty('timestamp');
      expect(context).toHaveProperty('userAgent');
      expect(context).toHaveProperty('url');
      expect(context).toHaveProperty('browserInfo');
      expect(context).toHaveProperty('networkInfo');
    });

    it('includes performance information when available', () => {
      // Mock performance API
      Object.defineProperty(window, 'performance', {
        value: {
          timing: { navigationStart: 1000 },
          memory: { usedJSHeapSize: 1000, totalJSHeapSize: 2000, jsHeapSizeLimit: 5000 },
        },
        writable: true,
      });

      const context = errorHandler['enhanceContext']({}, 'manual');

      expect(context.performanceInfo).toBeDefined();
      expect(context.performanceInfo?.memory).toBeDefined();
    });
  });
});
