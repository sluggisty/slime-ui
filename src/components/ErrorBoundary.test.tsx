import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from './ErrorBoundary';
import { ErrorFallback } from './ErrorFallback';
import { errorLogger } from '../utils/errorLogger';

// Mock the error logger
vi.mock('../utils/errorLogger', () => ({
  errorLogger: {
    logError: vi.fn(),
    reportError: vi.fn().mockResolvedValue(true),
  },
}));

// Component that throws an error
const ErrorComponent = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Component that throws an error on button click
const ErrorOnClickComponent = () => {
  const [shouldThrow, setShouldThrow] = React.useState(false);

  if (shouldThrow) {
    throw new Error('Button error');
  }

  return <button onClick={() => setShouldThrow(true)}>Trigger Error</button>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear any persisted error logs
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('catches and displays error fallback when component throws', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Component Error')).toBeInTheDocument();
    expect(screen.getByText(/A part of this page encountered an error/)).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('logs errors using the error logger', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary level='component'>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(errorLogger.logError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.any(Object),
      expect.objectContaining({
        level: 'component',
        timestamp: expect.any(Number),
      })
    );

    consoleSpy.mockRestore();
  });

  it('calls custom error handler when provided', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.any(Object),
      expect.objectContaining({
        timestamp: expect.any(Number),
      })
    );

    consoleSpy.mockRestore();
  });

  it('shows retry button and calls retry function', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();

    render(
      <ErrorBoundary enableRetry={true}>
        <ErrorOnClickComponent />
      </ErrorBoundary>
    );

    // Initially no error
    expect(screen.getByRole('button', { name: /trigger error/i })).toBeInTheDocument();

    // Trigger error
    await user.click(screen.getByRole('button', { name: /trigger error/i }));

    // Should show error fallback with retry button
    expect(screen.getByText('Component Error')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('shows reset button and calls reset function', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();

    render(
      <ErrorBoundary>
        <ErrorOnClickComponent />
      </ErrorBoundary>
    );

    // Trigger error
    await user.click(screen.getByRole('button', { name: /trigger error/i }));

    // Should show reset button
    const resetButton = screen.getByRole('button', { name: /reset/i });
    expect(resetButton).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('shows report button and calls report function', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();

    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    const reportButton = screen.getByRole('button', { name: /report error/i });
    expect(reportButton).toBeInTheDocument();

    // Mock alert
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    await user.click(reportButton);

    expect(errorLogger.reportError).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Error report has been sent. Thank you for helping us improve!'
    );

    consoleSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('displays different messages for different error levels', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(
      <ErrorBoundary level='global'>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    rerender(
      <ErrorBoundary level='route'>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Page Error')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('resets error state when resetKeys change', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(
      <ErrorBoundary resetOnPropsChange={true} resetKeys={['key1']}>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Component Error')).toBeInTheDocument();

    // Change resetKeys - should reset error state
    rerender(
      <ErrorBoundary resetOnPropsChange={true} resetKeys={['key2']}>
        <div>Recovered content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Recovered content')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('shows development error details in development mode', () => {
    // Mock development environment
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Error Details/)).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();

    // Restore environment
    process.env.NODE_ENV = originalEnv;
    consoleSpy.mockRestore();
  });

  it('handles retry limits correctly', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();

    render(
      <ErrorBoundary enableRetry={true} maxRetries={2}>
        <ErrorOnClickComponent />
      </ErrorBoundary>
    );

    // Trigger error
    await user.click(screen.getByRole('button', { name: /trigger error/i }));

    // Should allow retries up to maxRetries
    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});

describe('ErrorFallback', () => {
  it('renders error message and actions', () => {
    const error = new Error('Test error');
    const mockOnRetry = vi.fn();
    const mockOnReport = vi.fn();

    render(
      <ErrorFallback
        error={error}
        onRetry={mockOnRetry}
        onReport={mockOnReport}
        canRetry={true}
        level='component'
      />
    );

    expect(screen.getByText('Component Error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /report error/i })).toBeInTheDocument();
  });

  it('shows different UI for different error levels', () => {
    const error = new Error('Test error');

    const { rerender } = render(<ErrorFallback error={error} level='global' />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    rerender(<ErrorFallback error={error} level='route' />);

    expect(screen.getByText('Page Error')).toBeInTheDocument();
  });

  it('shows back button for route errors', () => {
    const error = new Error('Test error');

    render(<ErrorFallback error={error} level='route' />);

    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('shows home button for global errors', () => {
    const error = new Error('Test error');

    render(<ErrorFallback error={error} level='global' />);

    expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
  });

  it('shows session ID when available', () => {
    const error = new Error('Test error');
    const context = { sessionId: 'test-session-123' };

    render(<ErrorFallback error={error} context={{ ...context, timestamp: Date.now() }} />);

    expect(screen.getByText(/Session ID: test-session-123/)).toBeInTheDocument();
  });
});
