import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, LogLevel } from './logger';

// Mock fetch for external logging
global.fetch = vi.fn();

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset logger state
    logger['logBuffer'] = [];
    logger['sessionId'] = 'test-session';
    logger['correlationId'] = 'test-correlation';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Log Levels', () => {
    it('logs messages at appropriate levels', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      logger.info('Test info message');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('filters logs below minimum level', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      // Set level to INFO
      logger['config'].level = LogLevel.INFO;

      logger.debug('Debug message'); // Should be filtered
      expect(consoleSpy).not.toHaveBeenCalled();

      logger.info('Info message'); // Should be logged
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Structured Logging', () => {
    it('includes context in log entries', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      logger.info('Test message', {
        userId: 'user123',
        action: 'test_action',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]: Test message'),
        expect.objectContaining({
          message: 'Test message',
          context: expect.objectContaining({
            userId: 'user123',
            action: 'test_action',
            sessionId: 'test-session',
            correlationId: 'test-correlation',
          }),
        })
      );

      consoleSpy.mockRestore();
    });

    it('sanitizes sensitive data', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      logger.info('Login attempt', {
        email: 'user@example.com',
        password: 'secret123',
        token: 'jwt.token.here',
      });

      const loggedData = consoleSpy.mock.calls[0][1];

      expect(loggedData.data.password).toBe('[REDACTED]');
      expect(loggedData.data.token).toBe('[REDACTED]');
      expect(loggedData.data.email).toBe('user@example.com'); // Not sensitive

      consoleSpy.mockRestore();
    });
  });

  describe('Performance Monitoring', () => {
    it('measures performance with startTimer', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const endTimer = logger.startTimer('test_operation');
      // Simulate some work
      setTimeout(() => {
        endTimer();
      }, 10);

      // Wait for the timer to execute
      setTimeout(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Performance: test_operation'),
          expect.objectContaining({
            context: expect.objectContaining({
              duration: expect.any(Number),
              metric: 'test_operation',
            }),
          })
        );
      }, 20);

      consoleSpy.mockRestore();
    });

    it('measures async operations', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const result = await logger.measureAsync('async_test', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      });

      expect(result).toBe('success');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance: async_test_success'),
        expect.objectContaining({
          context: expect.objectContaining({
            duration: expect.any(Number),
          }),
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('User Activity Tracking', () => {
    it('tracks page views', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      logger.trackPageView('/dashboard', { userId: 'user123' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Page View: /dashboard'),
        expect.objectContaining({
          context: expect.objectContaining({
            route: '/dashboard',
            action: 'page_view',
            userId: 'user123',
          }),
        })
      );

      consoleSpy.mockRestore();
    });

    it('tracks user actions', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      logger.trackAction('button_click', { buttonId: 'save' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('User Action: button_click'),
        expect.objectContaining({
          context: expect.objectContaining({
            action: 'button_click',
            buttonId: 'save',
          }),
        })
      );

      consoleSpy.mockRestore();
    });

    it('tracks engagement metrics', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      logger.trackEngagement('scroll_depth', 75);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Engagement: scroll_depth'),
        expect.objectContaining({
          context: expect.objectContaining({
            engagement_event: 'scroll_depth',
            engagement_value: 75,
          }),
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('External Logging', () => {
    beforeEach(() => {
      // Enable external logging
      logger.updateConfig({
        enableExternal: true,
        externalEndpoint: 'https://api.test.com/logs',
      });
    });

    it('sends logs to external service', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;

      logger.info('External log test');
      await logger['flush'](); // Manually flush

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/logs',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        })
      );

      const sentData = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentData.logs).toHaveLength(1);
      expect(sentData.logs[0].message).toBe('External log test');
    });

    it('batches logs for external sending', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;

      // Add multiple logs
      logger.info('Log 1');
      logger.info('Log 2');
      logger.info('Log 3');

      await logger['flush']();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const sentData = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentData.logs).toHaveLength(3);
    });
  });

  describe('Error Handling', () => {
    it('handles logging errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Force an error in logging
      logger['logToConsole'] = vi.fn(() => {
        throw new Error('Console error');
      });

      logger.info('Test message');

      // Should not crash, should log the error
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Configuration', () => {
    it('updates configuration', () => {
      logger.updateConfig({
        level: LogLevel.DEBUG,
        maxBatchSize: 5,
      });

      expect(logger['config'].level).toBe(LogLevel.DEBUG);
      expect(logger['config'].maxBatchSize).toBe(5);
    });

    it('respects sanitize fields configuration', () => {
      logger.updateConfig({
        sanitizeFields: ['custom_secret'],
      });

      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      logger.info('Test', {}, { custom_secret: 'secret_value', normal_field: 'normal' });

      const loggedData = consoleSpy.mock.calls[0][1];
      expect(loggedData.data.custom_secret).toBe('[REDACTED]');
      expect(loggedData.data.normal_field).toBe('normal');

      consoleSpy.mockRestore();
    });
  });

  describe('Session Management', () => {
    it('generates unique session and correlation IDs', () => {
      const sessionId1 = logger['generateSessionId']();
      const correlationId1 = logger['generateCorrelationId']();

      // Create new logger instance
      const logger2 = new (logger.constructor as any)();
      const sessionId2 = logger2['generateSessionId']();
      const correlationId2 = logger2['generateCorrelationId']();

      expect(sessionId1).not.toBe(sessionId2);
      expect(correlationId1).not.toBe(correlationId2);
    });
  });
});
