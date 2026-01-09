import type { Report, HostsResponse, HealthResponse } from '../types';
import { config } from '../config/config';
import { auth } from './auth';
import { errorHandler } from '../utils/errorHandler';

// ============================================================================
// ERROR CLASSES AND TYPES
// ============================================================================

/**
 * Base API Error class with enhanced context and metadata
 */
export class ApiError extends Error {
  public readonly status?: number;
  public readonly code?: string;
  public readonly details?: any;
  public readonly retryable: boolean;
  public readonly timestamp: number;
  public readonly context?: {
    url: string;
    method: string;
    userId?: string;
    sessionId?: string;
    requestId?: string;
    duration?: number;
  };
  public readonly category: string;

  constructor(
    message: string,
    status?: number,
    code?: string,
    details?: any,
    retryable: boolean = false,
    context?: ApiError['context']
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryable = retryable;
    this.timestamp = Date.now();
    this.context = context;
    this.category = this.determineCategory();
  }

  private determineCategory(): string {
    if (this.status) {
      if (this.status >= 400 && this.status < 500) {
        return 'client_error';
      } else if (this.status >= 500) {
        return 'server_error';
      }
    }
    return 'network_error';
  }

  /**
   * Check if this error is retryable
   */
  isRetryable(): boolean {
    return this.retryable;
  }

  /**
   * Get user-friendly message
   */
  getUserMessage(): string {
    return this.getDefaultUserMessage();
  }

  private getDefaultUserMessage(): string {
    switch (this.category) {
      case 'network_error':
        return 'Unable to connect to our servers. Please check your internet connection and try again.';
      case 'client_error':
        if (this.status === 401) {
          return 'Your session has expired. Please sign in again.';
        } else if (this.status === 403) {
          return "You don't have permission to perform this action.";
        } else if (this.status === 404) {
          return 'The requested resource was not found.';
        } else if (this.status === 422) {
          return 'Please check your input and try again.';
        }
        return 'There was a problem with your request. Please try again.';
      case 'server_error':
        return 'Our servers are experiencing issues. Please try again in a few moments.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }

  /**
   * Convert to plain object for logging/serialization
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      details: this.details,
      retryable: this.retryable,
      timestamp: this.timestamp,
      context: this.context,
      category: this.category,
      stack: this.stack,
    };
  }
}

/**
 * Network-specific error
 */
export class NetworkError extends ApiError {
  constructor(message: string, context?: ApiError['context']) {
    super(message, undefined, 'NETWORK_ERROR', undefined, true, context);
    this.name = 'NetworkError';
  }

  getUserMessage(): string {
    return 'Connection problem. Please check your internet connection and try again.';
  }
}

/**
 * Timeout-specific error
 */
export class TimeoutError extends ApiError {
  constructor(timeout: number, context?: ApiError['context']) {
    super(`Request timeout after ${timeout}ms`, 408, 'TIMEOUT_ERROR', { timeout }, true, context);
    this.name = 'TimeoutError';
  }

  getUserMessage(): string {
    return 'The request took too long to complete. Please try again.';
  }
}

/**
 * Validation-specific error
 */
export class ValidationError extends ApiError {
  public readonly validationErrors: Record<string, string[]>;

  constructor(
    message: string,
    validationErrors: Record<string, string[]>,
    context?: ApiError['context']
  ) {
    super(message, 422, 'VALIDATION_ERROR', { validationErrors }, false, context);
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
  }

  getUserMessage(): string {
    const fieldCount = Object.keys(this.validationErrors).length;
    return `Please correct the ${fieldCount === 1 ? 'error' : 'errors'} in your input and try again.`;
  }

  /**
   * Get validation errors for a specific field
   */
  getFieldErrors(field: string): string[] {
    return this.validationErrors[field] || [];
  }

  /**
   * Get all validation errors as a flat array
   */
  getAllErrors(): Array<{ field: string; message: string }> {
    return Object.entries(this.validationErrors).flatMap(([field, messages]) =>
      messages.map(message => ({ field, message }))
    );
  }
}

/**
 * Authentication-specific error
 */
export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required', context?: ApiError['context']) {
    super(message, 401, 'AUTHENTICATION_ERROR', undefined, false, context);
    this.name = 'AuthenticationError';
  }

  getUserMessage(): string {
    return 'Your session has expired. Please sign in again.';
  }
}

/**
 * Authorization-specific error
 */
export class AuthorizationError extends ApiError {
  constructor(message: string = 'Insufficient permissions', context?: ApiError['context']) {
    super(message, 403, 'AUTHORIZATION_ERROR', undefined, false, context);
    this.name = 'AuthorizationError';
  }

  getUserMessage(): string {
    return "You don't have permission to perform this action.";
  }
}

/**
 * Rate limiting error
 */
export class RateLimitError extends ApiError {
  public readonly resetTime: number;

  constructor(message: string, resetTime: number, context?: ApiError['context']) {
    super(message, 429, 'RATE_LIMIT_ERROR', { resetTime }, true, context);
    this.name = 'RateLimitError';
    this.resetTime = resetTime;
  }

  getUserMessage(): string {
    const waitSeconds = Math.ceil((this.resetTime - Date.now()) / 1000);
    return `Too many requests. Please wait ${waitSeconds} seconds before trying again.`;
  }

  /**
   * Get seconds until reset
   */
  getSecondsUntilReset(): number {
    return Math.max(0, Math.ceil((this.resetTime - Date.now()) / 1000));
  }
}

/**
 * Server error (5xx)
 */
export class ServerError extends ApiError {
  constructor(message: string, status: number, context?: ApiError['context']) {
    super(message, status, 'SERVER_ERROR', undefined, true, context);
    this.name = 'ServerError';
  }

  getUserMessage(): string {
    return 'Our servers are experiencing issues. Please try again in a few moments.';
  }
}

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface RequestOptions extends RequestInit {
  timeout?: number;
  skipRetry?: boolean;
  skipAuth?: boolean;
  retryConfig?: {
    maxRetries?: number;
    retryDelay?: number;
    retryableStatuses?: number[];
    exponentialBackoff?: boolean;
  };
}

/**
 * Legacy interface for backward compatibility
 */
interface LegacyApiError extends Error {
  status?: number;
  code?: string;
  details?: any;
  retryable?: boolean;
  timestamp: number;
  context?: {
    url: string;
    method: string;
    userId?: string;
    sessionId?: string;
  };
}

interface RetryState {
  attempt: number;
  delay: number;
}

interface RateLimitState {
  requests: number;
  resetTime: number;
}

// ============================================================================
// CONSTANTS AND CONFIGURATION
// ============================================================================

const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100; // Adjust based on backend limits

// ============================================================================
// SECURE STORAGE UTILITY
// ============================================================================

export class SecureStorage {
  private readonly keyPrefix = 'slime_ui_';

  set(key: string, value: string): void {
    try {
      localStorage.setItem(this.keyPrefix + key, value);
    } catch (error) {
      console.error('Failed to store data:', error);
      throw new Error('Unable to store data');
    }
  }

  get(key: string): string | null {
    try {
      return localStorage.getItem(this.keyPrefix + key);
    } catch (error) {
      console.error('Failed to retrieve data:', error);
      return null;
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.keyPrefix + key);
    } catch (error) {
      console.error('Failed to remove data:', error);
    }
  }

  clear(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.keyPrefix));
      keys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Failed to clear data:', error);
    }
  }
}

// ============================================================================
// TOKEN MANAGER (Moved here to avoid circular dependencies)
// ============================================================================

interface TokenState {
  token_info: TokenInfo | null;
  session: AuthSession | null;
  refreshPromise: Promise<TokenInfo> | null;
  isRefreshing: boolean;
}

class TokenManager {
  private state: TokenState = {
    token_info: null,
    session: null,
    refreshPromise: null,
    isRefreshing: false,
  };

  private refreshTimer: NodeJS.Timeout | null = null;
  private activityTimer: NodeJS.Timeout | null = null;
  private sessionTimeoutTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.loadStoredTokens();
    this.initializeSessionMonitoring();
  }

  // Basic token management methods needed by client
  setTokenInfo(tokenInfo: TokenInfo): void {
    this.state.token_info = tokenInfo;

    // Store encrypted token data
    const encryptedData = this.encryptTokenData(tokenInfo);
    secureStorage.set('token_info', encryptedData);

    // Schedule automatic refresh
    if (config.auth.enableAutoRefresh) {
      this.scheduleTokenRefresh();
    }
  }

  async refreshTokenIfNeeded(): Promise<TokenInfo | null> {
    if (!this.state.token_info) return null;
    if (!this.shouldRefreshToken(this.state.token_info)) return this.state.token_info;

    // Prevent multiple concurrent refresh requests
    if (this.state.isRefreshing && this.state.refreshPromise) {
      return this.state.refreshPromise;
    }

    this.state.isRefreshing = true;
    this.state.refreshPromise = this.performTokenRefresh();

    try {
      const newTokenInfo = await this.state.refreshPromise;
      this.setTokenInfo(newTokenInfo);
      return newTokenInfo;
    } catch (error) {
      console.error('[TokenManager] Token refresh failed:', error);
      this.clearTokens();
      throw error;
    } finally {
      this.state.isRefreshing = false;
      this.state.refreshPromise = null;
    }
  }

  getApiKey(): string | null {
    if (!this.state.token_info) return null;

    // Check if token is expired
    if (this.isTokenExpired(this.state.token_info)) {
      this.clearTokens();
      return null;
    }

    return this.state.token_info.token;
  }

  clearTokens(): void {
    this.state.token_info = null;
    this.state.session = null;
    this.state.refreshPromise = null;
    this.state.isRefreshing = false;

    // Clear timers
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    if (this.activityTimer) clearInterval(this.activityTimer);
    if (this.sessionTimeoutTimer) clearInterval(this.sessionTimeoutTimer);

    // Clear storage
    secureStorage.remove('token_info');
    secureStorage.remove('session');
  }

  private shouldRefreshToken(tokenInfo: TokenInfo): boolean {
    if (!tokenInfo.expires_at) return false;
    const expiresAt = new Date(tokenInfo.expires_at).getTime();
    return expiresAt - Date.now() <= config.auth.tokenRefreshBuffer;
  }

  private isTokenExpired(tokenInfo: TokenInfo): boolean {
    if (!tokenInfo.expires_at) return false;
    return Date.now() >= new Date(tokenInfo.expires_at).getTime();
  }

  private async performTokenRefresh(): Promise<TokenInfo> {
    if (!this.state.token_info?.refresh_token) {
      throw new Error('No refresh token available');
    }

    // Use a basic fetch to avoid circular dependency
    const response = await fetch(getApiUrl(config.api.endpoints.auth.refresh), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: this.state.token_info.refresh_token,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    return data.token_info;
  }

  private scheduleTokenRefresh(): void {
    if (!this.state.token_info?.expires_at) return;

    if (this.refreshTimer) clearTimeout(this.refreshTimer);

    const expiresAt = new Date(this.state.token_info.expires_at).getTime();
    const refreshAt = expiresAt - config.auth.tokenRefreshBuffer;
    const delay = Math.max(0, refreshAt - Date.now());

    if (delay > 0) {
      this.refreshTimer = setTimeout(async () => {
        try {
          await this.refreshTokenIfNeeded();
        } catch (error) {
          console.error('[TokenManager] Scheduled refresh failed:', error);
        }
      }, delay);
    }
  }

  private initializeSessionMonitoring(): void {
    if (!config.auth.enableSessionMonitoring || typeof window === 'undefined') return;

    // Basic activity monitoring
    const updateActivity = () => {
      if (this.state.session) {
        this.state.session.last_activity = new Date().toISOString();
        secureStorage.set('session', JSON.stringify(this.state.session));
      }
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Session timeout check
    this.sessionTimeoutTimer = setInterval(() => {
      this.checkSessionTimeout();
    }, config.auth.activityCheckInterval);
  }

  private checkSessionTimeout(): void {
    if (!this.state.session) return;

    const lastActivity = new Date(this.state.session.last_activity).getTime();
    const sessionExpiry = new Date(this.state.session.expires_at).getTime();

    if (Date.now() - lastActivity > config.auth.sessionTimeout || Date.now() > sessionExpiry) {
      this.handleSessionTimeout();
    }
  }

  private handleSessionTimeout(): void {
    this.clearTokens();

    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('sessionTimeout'));
    }

    if (typeof window !== 'undefined') {
      window.location.href = '/login?reason=session_timeout';
    }
  }

  private loadStoredTokens(): void {
    try {
      const encryptedTokenData = secureStorage.get('token_info');
      if (encryptedTokenData) {
        const tokenInfo = this.decryptTokenData(encryptedTokenData);
        if (tokenInfo && !this.isTokenExpired(tokenInfo)) {
          this.state.token_info = tokenInfo;
        }
      }

      const sessionData = secureStorage.get('session');
      if (sessionData) {
        this.state.session = JSON.parse(sessionData);
      }
    } catch (error) {
      console.error('[TokenManager] Failed to load tokens:', error);
      this.clearTokens();
    }
  }

  private encryptTokenData(tokenInfo: TokenInfo): string {
    const payload = JSON.stringify(tokenInfo);
    const key = config.app.name.slice(0, 32);
    let encrypted = '';
    for (let i = 0; i < payload.length; i++) {
      encrypted += String.fromCharCode(payload.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(encrypted);
  }

  private decryptTokenData(encryptedData: string): TokenInfo | null {
    try {
      const key = config.app.name.slice(0, 32);
      const encrypted = atob(encryptedData);
      let decrypted = '';
      for (let i = 0; i < encrypted.length; i++) {
        decrypted += String.fromCharCode(encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return JSON.parse(decrypted);
    } catch {
      return null;
    }
  }
}

// Global instances
const secureStorage = new SecureStorage();
const tokenManager = new TokenManager();

// Export for use in auth.ts
export { tokenManager };

// Convert relative URLs to absolute in Node.js test environment (only when TEST_API_CLIENT env var is set)
const getApiUrl = (endpoint: string): string => {
  const fullPath = config.api.basePath + endpoint;
  // Only convert if TEST_API_CLIENT env var is set (only for API client tests)
  if (
    fullPath.startsWith('/') &&
    typeof process !== 'undefined' &&
    process.env.TEST_API_CLIENT === 'true'
  ) {
    return `http://localhost${fullPath}`;
  }
  return fullPath;
};

// ============================================================================
// RATE LIMITING
// ============================================================================

class RateLimiter {
  private state: RateLimitState = {
    requests: 0,
    resetTime: Date.now() + RATE_LIMIT_WINDOW,
  };

  checkLimit(): boolean {
    const now = Date.now();

    // Reset counter if window has passed
    if (now >= this.state.resetTime) {
      this.state.requests = 0;
      this.state.resetTime = now + RATE_LIMIT_WINDOW;
    }

    // Check if under limit
    if (this.state.requests >= MAX_REQUESTS_PER_WINDOW) {
      return false;
    }

    this.state.requests++;
    return true;
  }

  getRemainingRequests(): number {
    return Math.max(0, MAX_REQUESTS_PER_WINDOW - this.state.requests);
  }

  getResetTime(): number {
    return this.state.resetTime;
  }
}

const rateLimiter = new RateLimiter();

// ============================================================================
// REQUEST/RESPONSE INTERCEPTORS
// ============================================================================

interface RequestInterceptor {
  (url: string, options: RequestInit): Promise<RequestInit> | RequestInit;
}

interface ResponseInterceptor {
  (response: Response, data?: unknown): Promise<unknown> | unknown;
}

class InterceptorManager {
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  async runRequestInterceptors(url: string, options: RequestInit): Promise<RequestInit> {
    let processedOptions = { ...options };

    for (const interceptor of this.requestInterceptors) {
      processedOptions = await interceptor(url, processedOptions);
    }

    return processedOptions;
  }

  async runResponseInterceptors(response: Response, data?: unknown): Promise<unknown> {
    let processedData = data;

    for (const interceptor of this.responseInterceptors) {
      processedData = await interceptor(response, processedData);
    }

    return processedData;
  }
}

const interceptors = new InterceptorManager();

// Default request interceptor for logging
interceptors.addRequestInterceptor(async (url, options) => {
  if (config.features.enableDebugLogging) {
    console.log(`[API Request] ${options.method || 'GET'} ${url}`, {
      headers: sanitizeHeadersForLogging(options.headers),
      body: options.body ? '[REQUEST BODY]' : undefined,
    });
  }
  return options;
});

// Default response interceptor for logging
interceptors.addResponseInterceptor(async (response, data) => {
  if (config.features.enableDebugLogging) {
    console.log(`[API Response] ${response.status} ${response.url}`);
  }
  return data;
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Sanitize headers for logging (remove sensitive information)
 */
function sanitizeHeadersForLogging(headers?: HeadersInit): Record<string, string> | undefined {
  if (!headers) return undefined;

  const sanitized: Record<string, string> = {};
  const headerEntries =
    headers instanceof Headers ? Array.from(headers.entries()) : Object.entries(headers);

  for (const [key, value] of headerEntries) {
    // Never log API keys or other sensitive headers
    if (
      key.toLowerCase().includes('api-key') ||
      key.toLowerCase().includes('authorization') ||
      key.toLowerCase().includes('csrf')
    ) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = String(value);
    }
  }

  return sanitized;
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  // Network errors, 5xx server errors, and specific 4xx errors are retryable
  if (error instanceof Error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return true; // Network error
    }
  }

  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: number }).status;
    if (status) {
      // 5xx errors are retryable
      if (status >= 500) return true;
      // 429 (Too Many Requests) is retryable
      if (status === 429) return true;
      // 408 (Request Timeout) is retryable
      if (status === 408) return true;
    }
  }

  return false;
}

/**
 * Calculate retry delay with exponential backoff
 */
function calculateRetryDelay(attempt: number): number {
  const baseDelay = config.api.retry.initialDelay;
  const multiplier = config.api.retry.backoffMultiplier;
  const delay = baseDelay * Math.pow(multiplier, attempt - 1);

  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delay;
  return Math.min(delay + jitter, 30000); // Cap at 30 seconds
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate API response structure
 */
function validateApiResponse<T>(data: unknown, endpoint: string): T {
  // Basic validation - ensure we have valid data
  if (data === null || data === undefined) {
    throw new Error(`Invalid response from ${endpoint}: response is null or undefined`);
  }

  // Additional validation can be added here based on endpoint
  // For example, check required fields for specific endpoints

  return data as T;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get current user ID from auth context
 */
function getCurrentUserId(): string | undefined {
  // This would integrate with your auth system
  return undefined;
}

/**
 * Get current session ID
 */
function getCurrentSessionId(): string | undefined {
  if (typeof sessionStorage !== 'undefined') {
    let sessionId = sessionStorage.getItem('api_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('api_session_id', sessionId);
    }
    return sessionId;
  }
  return undefined;
}

/**
 * Create appropriate error type based on response/status
 */
function createApiError(
  message: string,
  response?: Response,
  originalError?: Error | unknown,
  requestContext?: { url: string; method: string; duration?: number }
): ApiError {
  const status = response?.status;
  const url = requestContext?.url || response?.url || 'unknown';
  const method = requestContext?.method || 'GET';
  const requestId = generateRequestId();

  const context: ApiError['context'] = {
    url,
    method,
    userId: getCurrentUserId(),
    sessionId: getCurrentSessionId(),
    requestId,
    duration: requestContext?.duration,
  };

  // Handle different error types based on status or error type
  if (originalError instanceof TimeoutError) {
    return originalError;
  }

  if (status === 401) {
    return new AuthenticationError(message, context);
  }

  if (status === 403) {
    return new AuthorizationError(message, context);
  }

  if (status === 404) {
    return new ApiError(message, status, 'NOT_FOUND', undefined, false, context);
  }

  if (status === 408) {
    return new TimeoutError(30000, context); // Default timeout
  }

  if (status === 422) {
    // Try to extract validation errors from response
    let validationErrors: Record<string, string[]> = {};
    if (response) {
      try {
        // This would need to be implemented based on your API response format
        // For now, create a generic validation error
        validationErrors = { general: [message] };
      } catch {
        // If we can't parse validation errors, create generic validation error
        validationErrors = { general: [message] };
      }
    }
    return new ValidationError(message, validationErrors, context);
  }

  if (status === 429) {
    // Extract retry-after header if available
    const retryAfter = response?.headers.get('retry-after');
    const resetTime = retryAfter ? Date.now() + parseInt(retryAfter) * 1000 : Date.now() + 60000; // Default 1 minute

    return new RateLimitError(message, resetTime, context);
  }

  if (status && status >= 500) {
    return new ServerError(message, status, context);
  }

  if (status && status >= 400 && status < 500) {
    return new ApiError(message, status, `CLIENT_ERROR_${status}`, undefined, false, context);
  }

  // Network or unknown errors
  if (
    originalError instanceof Error &&
    originalError.name === 'TypeError' &&
    originalError.message.includes('fetch')
  ) {
    return new NetworkError(message, context);
  }

  // Generic API error
  return new ApiError(
    message,
    status,
    status ? `HTTP_${status}` : 'NETWORK_ERROR',
    originalError instanceof Error ? { originalError: originalError.message } : originalError,
    isRetryableStatus(status),
    context
  );
}

// ============================================================================
// ENHANCED FETCH FUNCTION
// ============================================================================

export async function fetchApi<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const {
    timeout = config.api.timeout,
    skipRetry = false,
    skipAuth = false,
    retryConfig,
    ...fetchOptions
  } = options;

  // Enhanced retry configuration
  const retryOptions = {
    maxRetries: retryConfig?.maxRetries ?? config.api.retry.maxAttempts,
    retryDelay: retryConfig?.retryDelay ?? config.api.retry.baseDelay,
    retryableStatuses: retryConfig?.retryableStatuses ?? [408, 429, 500, 502, 503, 504],
    exponentialBackoff: retryConfig?.exponentialBackoff ?? config.api.retry.exponentialBackoff,
  };

  // Check rate limiting
  if (!rateLimiter.checkLimit()) {
    const resetTime = rateLimiter.getResetTime();
    const waitTime = resetTime - Date.now();
    const rateLimitError = new RateLimitError(
      `Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`,
      resetTime,
      {
        url: getApiUrl(endpoint),
        method: fetchOptions.method || 'GET',
        userId: getCurrentUserId(),
        sessionId: getCurrentSessionId(),
        requestId: generateRequestId(),
      }
    );
    throw rateLimitError;
  }

  // Get API key from token manager (with automatic refresh)
  const apiKey = skipAuth
    ? null
    : await tokenManager.refreshTokenIfNeeded().then(info => info?.token || null);

  // Build headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  // CSRF token support (if available)
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const url = getApiUrl(endpoint);
  let processedOptions: RequestInit = {
    ...fetchOptions,
    headers,
  };

  // Run request interceptors
  processedOptions = await interceptors.runRequestInterceptors(url, processedOptions);

  // Enhanced retry logic
  const maxAttempts = skipRetry ? 1 : retryOptions.maxRetries;
  let lastError: unknown;
  const requestStartTime = Date.now();
  const requestId = generateRequestId();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const retryState: RetryState = { attempt, delay: 0 };

    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...processedOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle HTTP errors
      if (!response.ok) {
        // Handle 401 by clearing auth and redirecting to login
        if (response.status === 401) {
          auth.removeApiKey();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          throw createApiError('Unauthorized', response);
        }

        // Try to parse error response
        let errorData: Record<string, unknown> = {};
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: 'Unknown error' };
        }

        const errorMessage =
          (errorData as any)?.error ||
          errorData?.message ||
          `HTTP ${response.status}: ${response.statusText}`;
        const apiError = createApiError(errorMessage, response, errorData, {
          url: url.toString(),
          method: fetchOptions.method || 'GET',
        });

        // Check if error is retryable
        if (attempt < maxAttempts && isRetryableError(apiError)) {
          retryState.delay = calculateRetryDelay(attempt);
          if (config.features.enableDebugLogging) {
            console.log(
              `[API Retry] Attempt ${attempt} failed, retrying in ${retryState.delay}ms:`,
              errorMessage
            );
          }
          await sleep(retryState.delay);
          continue;
        }

        throw apiError;
      }

      // Parse response
      let data: unknown;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Validate response
      const validatedData = validateApiResponse<T>(data, endpoint);

      // Run response interceptors
      const finalData = await interceptors.runResponseInterceptors(response, validatedData);

      return finalData;
    } catch (error: unknown) {
      lastError = error;

      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new TimeoutError(timeout, {
          url: url.toString(),
          method: fetchOptions.method || 'GET',
          userId: getCurrentUserId(),
          sessionId: getCurrentSessionId(),
          requestId,
        });

        if (attempt < maxAttempts && timeoutError.isRetryable()) {
          retryState.delay = retryOptions.exponentialBackoff
            ? retryOptions.retryDelay * Math.pow(2, attempt - 1)
            : retryOptions.retryDelay;

          if (config.features.enableDebugLogging) {
            console.log(
              `[API Retry] Timeout on attempt ${attempt}, retrying in ${retryState.delay}ms`
            );
          }
          await sleep(retryState.delay);
          continue;
        }
        throw timeoutError;
      }

      // Handle network errors
      if (error instanceof Error && error.name === 'TypeError' && error.message.includes('fetch')) {
        const networkError = new NetworkError(error.message, {
          url: url.toString(),
          method: fetchOptions.method || 'GET',
          userId: getCurrentUserId(),
          sessionId: getCurrentSessionId(),
          requestId,
        });

        if (attempt < maxAttempts && networkError.isRetryable()) {
          retryState.delay = retryOptions.exponentialBackoff
            ? retryOptions.retryDelay * Math.pow(2, attempt - 1)
            : retryOptions.retryDelay;

          if (config.features.enableDebugLogging) {
            console.log(
              `[API Retry] Network error on attempt ${attempt}, retrying in ${retryState.delay}ms`
            );
          }
          await sleep(retryState.delay);
          continue;
        }
        throw networkError;
      }

      // For non-retryable errors or last attempt, throw immediately
      if (!isRetryableError(error) || attempt === maxAttempts) {
        throw error;
      }
    }
  }

  // This should never be reached, but just in case
  const requestDuration = Date.now() - requestStartTime;
  const finalError =
    lastError instanceof Error
      ? lastError
      : createApiError('Request failed after all retry attempts', undefined, lastError, {
          url: url.toString(),
          method: fetchOptions.method || 'GET',
          duration: requestDuration,
        });

  // Enhance error with request context if it's an ApiError
  if (finalError instanceof ApiError && finalError.context) {
    finalError.context.duration = requestDuration;
  }

  // Report the error using the global error handler
  await errorHandler.handleNetworkError(
    finalError,
    endpoint,
    fetchOptions.method || 'GET',
    finalError.status
  );

  throw finalError;
}

// ============================================================================
// CSRF TOKEN MANAGEMENT (SESSION-BASED)
// ============================================================================

/**
 * Get CSRF token from meta tag, cookie, or API endpoint
 * CSRF tokens are session-based - generated once at login and valid for the entire session
 * They are not refreshed with API tokens to keep the implementation simple
 */
function getCsrfToken(): string | null {
  // Try to get from meta tag first (set by server on initial page load)
  if (typeof document !== 'undefined') {
    const metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement;
    if (metaTag && metaTag.content) {
      return metaTag.content;
    }
  }

  // Try to get from cookie (fallback, set during login)
  if (typeof document !== 'undefined' && document.cookie) {
    const csrfCookie = document.cookie
      .split(';')
      .find(cookie => cookie.trim().startsWith('csrf_token='));
    if (csrfCookie) {
      return csrfCookie.split('=')[1];
    }
  }

  // Note: Could fall back to API call, but this would create circular dependency
  // since API calls need CSRF tokens. Better to ensure tokens are set via meta tag or cookie.
  return null;
}

/**
 * Set CSRF token (called when token is received from server)
 */
export function setCsrfToken(token: string): void {
  if (typeof document !== 'undefined') {
    // Update meta tag
    let metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement;
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = 'csrf-token';
      document.head.appendChild(metaTag);
    }
    metaTag.content = token;

    // Also set as cookie for fallback
    document.cookie = `csrf_token=${token}; path=/; secure; samesite=strict`;
  }
}

// ============================================================================
// API METHODS
// ============================================================================

export const api = {
  // Health check
  getHealth: () => fetchApi<HealthResponse>(config.api.endpoints.health),

  // Hosts
  getHosts: () => fetchApi<HostsResponse>(config.api.endpoints.hosts),

  // Get full host data (returns the complete report) by host_id (UUID)
  getHost: (hostID: string) => fetchApi<Report>(config.api.endpoints.hostById(hostID)),

  // Delete a host by host_id (UUID)
  deleteHost: async (hostID: string) => {
    await fetchApi<void>(config.api.endpoints.hostById(hostID), { method: 'DELETE' });
  },
};

// ============================================================================
// EXPORT INTERCEPTOR MANAGER FOR ADVANCED USAGE
// ============================================================================

export { interceptors };
export type { RequestInterceptor, ResponseInterceptor };
