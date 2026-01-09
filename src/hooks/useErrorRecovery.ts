import React, { useCallback, useState } from 'react';
import { errorLogger } from '../utils/errorLogger';

interface ErrorRecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
  onRetry?: (attempt: number) => void;
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

interface ErrorRecoveryState {
  isRetrying: boolean;
  retryCount: number;
  lastError: Error | null;
  canRetry: boolean;
}

/**
 * Hook for error recovery with retry logic
 */
export function useErrorRecovery(options: ErrorRecoveryOptions = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    exponentialBackoff = true,
    onRetry,
    onError,
    onSuccess,
  } = options;

  const [state, setState] = useState<ErrorRecoveryState>({
    isRetrying: false,
    retryCount: 0,
    lastError: null,
    canRetry: true,
  });

  /**
   * Execute a function with error recovery
   */
  const executeWithRecovery = useCallback(
    async <T>(operation: () => Promise<T>, context?: string): Promise<T | null> => {
      setState(prev => ({ ...prev, isRetrying: true, lastError: null }));

      try {
        const result = await operation();

        // Success - reset state
        setState({
          isRetrying: false,
          retryCount: 0,
          lastError: null,
          canRetry: true,
        });

        onSuccess?.();
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        // Log the error
        errorLogger.logError(err, undefined, {
          timestamp: Date.now(),
          route: context || 'unknown',
          retryCount: state.retryCount + 1,
        });

        // Update state
        const newRetryCount = state.retryCount + 1;
        const canRetry = newRetryCount < maxRetries;

        setState({
          isRetrying: false,
          retryCount: newRetryCount,
          lastError: err,
          canRetry,
        });

        onError?.(err);

        // If we can retry, do it automatically
        if (canRetry) {
          const delay = exponentialBackoff
            ? retryDelay * Math.pow(2, newRetryCount - 1)
            : retryDelay;

          onRetry?.(newRetryCount);

          setTimeout(() => {
            executeWithRecovery(operation, context);
          }, delay);
        }

        return null;
      }
    },
    [state.retryCount, maxRetries, retryDelay, exponentialBackoff, onRetry, onError, onSuccess]
  );

  /**
   * Manually retry the last failed operation
   */
  const retry = useCallback(
    async <T>(operation: () => Promise<T>, context?: string): Promise<T | null> => {
      if (!state.canRetry) {
        console.warn('Maximum retry attempts reached');
        return null;
      }

      return executeWithRecovery(operation, context);
    },
    [state.canRetry, executeWithRecovery]
  );

  /**
   * Reset the error recovery state
   */
  const reset = useCallback(() => {
    setState({
      isRetrying: false,
      retryCount: 0,
      lastError: null,
      canRetry: true,
    });
  }, []);

  /**
   * Report the current error
   */
  const reportError = useCallback(async () => {
    if (!state.lastError) return false;

    return errorLogger.reportError(state.lastError, undefined, {
      timestamp: Date.now(),
      retryCount: state.retryCount,
      route: 'manual-report',
    });
  }, [state.lastError, state.retryCount]);

  return {
    ...state,
    executeWithRecovery,
    retry,
    reset,
    reportError,
    hasError: state.lastError !== null,
    isMaxRetriesReached: state.retryCount >= maxRetries,
  };
}

/**
 * Hook for handling async operations with error recovery
 */
export function useAsyncWithRecovery<T>(
  asyncFn: () => Promise<T>,
  options: ErrorRecoveryOptions & {
    autoExecute?: boolean;
    context?: string;
  } = {}
) {
  const { autoExecute = false, context, ...recoveryOptions } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);

  const recovery = useErrorRecovery({
    ...recoveryOptions,
    onSuccess: () => {
      setLoading(false);
    },
    onError: () => {
      setLoading(false);
    },
  });

  const execute = useCallback(async () => {
    setLoading(true);
    const result = await recovery.executeWithRecovery(asyncFn, context);
    if (result !== null) {
      setData(result);
    }
    setLoading(false);
    return result;
  }, [asyncFn, context, recovery]);

  // Auto-execute if requested
  React.useEffect(() => {
    if (autoExecute) {
      execute();
    }
  }, [autoExecute, execute]);

  return {
    ...recovery,
    data,
    loading: loading || recovery.isRetrying,
    execute,
    refetch: execute,
  };
}
