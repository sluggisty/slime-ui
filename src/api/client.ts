import type {
  Report,
  HostsResponse,
  HealthResponse
} from '../types'
import { config } from '../config/config'
import { auth } from './auth'
import { errorHandler } from '../utils/errorHandler'

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface RequestOptions extends RequestInit {
  timeout?: number
  skipRetry?: boolean
  skipAuth?: boolean
}

interface ApiError extends Error {
  status?: number
  code?: string
  details?: unknown
}

interface RetryState {
  attempt: number
  delay: number
}

interface RateLimitState {
  requests: number
  resetTime: number
}

// ============================================================================
// CONSTANTS AND CONFIGURATION
// ============================================================================

const RATE_LIMIT_WINDOW = 60000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100 // Adjust based on backend limits

// ============================================================================
// SECURE STORAGE UTILITY
// ============================================================================

export class SecureStorage {
  private readonly keyPrefix = 'slime_ui_'

  set(key: string, value: string): void {
    try {
      localStorage.setItem(this.keyPrefix + key, value)
    } catch (error) {
      console.error('Failed to store data:', error)
      throw new Error('Unable to store data')
    }
  }

  get(key: string): string | null {
    try {
      return localStorage.getItem(this.keyPrefix + key)
    } catch (error) {
      console.error('Failed to retrieve data:', error)
      return null
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.keyPrefix + key)
    } catch (error) {
      console.error('Failed to remove data:', error)
    }
  }

  clear(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.keyPrefix))
      keys.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.error('Failed to clear data:', error)
    }
  }
}

// ============================================================================
// TOKEN MANAGER (Moved here to avoid circular dependencies)
// ============================================================================

interface TokenState {
  token_info: TokenInfo | null
  session: AuthSession | null
  refreshPromise: Promise<TokenInfo> | null
  isRefreshing: boolean
}

class TokenManager {
  private state: TokenState = {
    token_info: null,
    session: null,
    refreshPromise: null,
    isRefreshing: false
  }

  private refreshTimer: NodeJS.Timeout | null = null
  private activityTimer: NodeJS.Timeout | null = null
  private sessionTimeoutTimer: NodeJS.Timeout | null = null

  constructor() {
    this.loadStoredTokens()
    this.initializeSessionMonitoring()
  }

  // Basic token management methods needed by client
  setTokenInfo(tokenInfo: TokenInfo): void {
    this.state.token_info = tokenInfo

    // Store encrypted token data
    const encryptedData = this.encryptTokenData(tokenInfo)
    secureStorage.set('token_info', encryptedData)

    // Schedule automatic refresh
    if (config.auth.enableAutoRefresh) {
      this.scheduleTokenRefresh()
    }
  }

  async refreshTokenIfNeeded(): Promise<TokenInfo | null> {
    if (!this.state.token_info) return null
    if (!this.shouldRefreshToken(this.state.token_info)) return this.state.token_info

    // Prevent multiple concurrent refresh requests
    if (this.state.isRefreshing && this.state.refreshPromise) {
      return this.state.refreshPromise
    }

    this.state.isRefreshing = true
    this.state.refreshPromise = this.performTokenRefresh()

    try {
      const newTokenInfo = await this.state.refreshPromise
      this.setTokenInfo(newTokenInfo)
      return newTokenInfo
    } catch (error) {
      console.error('[TokenManager] Token refresh failed:', error)
      this.clearTokens()
      throw error
    } finally {
      this.state.isRefreshing = false
      this.state.refreshPromise = null
    }
  }

  getApiKey(): string | null {
    if (!this.state.token_info) return null

    // Check if token is expired
    if (this.isTokenExpired(this.state.token_info)) {
      this.clearTokens()
      return null
    }

    return this.state.token_info.token
  }

  clearTokens(): void {
    this.state.token_info = null
    this.state.session = null
    this.state.refreshPromise = null
    this.state.isRefreshing = false

    // Clear timers
    if (this.refreshTimer) clearTimeout(this.refreshTimer)
    if (this.activityTimer) clearInterval(this.activityTimer)
    if (this.sessionTimeoutTimer) clearInterval(this.sessionTimeoutTimer)

    // Clear storage
    secureStorage.remove('token_info')
    secureStorage.remove('session')
  }

  private shouldRefreshToken(tokenInfo: TokenInfo): boolean {
    if (!tokenInfo.expires_at) return false
    const expiresAt = new Date(tokenInfo.expires_at).getTime()
    return (expiresAt - Date.now()) <= config.auth.tokenRefreshBuffer
  }

  private isTokenExpired(tokenInfo: TokenInfo): boolean {
    if (!tokenInfo.expires_at) return false
    return Date.now() >= new Date(tokenInfo.expires_at).getTime()
  }

  private async performTokenRefresh(): Promise<TokenInfo> {
    if (!this.state.token_info?.refresh_token) {
      throw new Error('No refresh token available')
    }

    // Use a basic fetch to avoid circular dependency
    const response = await fetch(getApiUrl(config.api.endpoints.auth.refresh), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: this.state.token_info.refresh_token
      })
    })

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`)
    }

    const data = await response.json()
    return data.token_info
  }

  private scheduleTokenRefresh(): void {
    if (!this.state.token_info?.expires_at) return

    if (this.refreshTimer) clearTimeout(this.refreshTimer)

    const expiresAt = new Date(this.state.token_info.expires_at).getTime()
    const refreshAt = expiresAt - config.auth.tokenRefreshBuffer
    const delay = Math.max(0, refreshAt - Date.now())

    if (delay > 0) {
      this.refreshTimer = setTimeout(async () => {
        try {
          await this.refreshTokenIfNeeded()
        } catch (error) {
          console.error('[TokenManager] Scheduled refresh failed:', error)
        }
      }, delay)
    }
  }

  private initializeSessionMonitoring(): void {
    if (!config.auth.enableSessionMonitoring || typeof window === 'undefined') return

    // Basic activity monitoring
    const updateActivity = () => {
      if (this.state.session) {
        this.state.session.last_activity = new Date().toISOString()
        secureStorage.set('session', JSON.stringify(this.state.session))
      }
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true })
    })

    // Session timeout check
    this.sessionTimeoutTimer = setInterval(() => {
      this.checkSessionTimeout()
    }, config.auth.activityCheckInterval)
  }

  private checkSessionTimeout(): void {
    if (!this.state.session) return

    const lastActivity = new Date(this.state.session.last_activity).getTime()
    const sessionExpiry = new Date(this.state.session.expires_at).getTime()

    if (Date.now() - lastActivity > config.auth.sessionTimeout ||
        Date.now() > sessionExpiry) {
      this.handleSessionTimeout()
    }
  }

  private handleSessionTimeout(): void {
    this.clearTokens()

    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('sessionTimeout'))
    }

    if (typeof window !== 'undefined') {
      window.location.href = '/login?reason=session_timeout'
    }
  }

  private loadStoredTokens(): void {
    try {
      const encryptedTokenData = secureStorage.get('token_info')
      if (encryptedTokenData) {
        const tokenInfo = this.decryptTokenData(encryptedTokenData)
        if (tokenInfo && !this.isTokenExpired(tokenInfo)) {
          this.state.token_info = tokenInfo
        }
      }

      const sessionData = secureStorage.get('session')
      if (sessionData) {
        this.state.session = JSON.parse(sessionData)
      }
    } catch (error) {
      console.error('[TokenManager] Failed to load tokens:', error)
      this.clearTokens()
    }
  }

  private encryptTokenData(tokenInfo: TokenInfo): string {
    const payload = JSON.stringify(tokenInfo)
    const key = config.app.name.slice(0, 32)
    let encrypted = ''
    for (let i = 0; i < payload.length; i++) {
      encrypted += String.fromCharCode(payload.charCodeAt(i) ^ key.charCodeAt(i % key.length))
    }
    return btoa(encrypted)
  }

  private decryptTokenData(encryptedData: string): TokenInfo | null {
    try {
      const key = config.app.name.slice(0, 32)
      const encrypted = atob(encryptedData)
      let decrypted = ''
      for (let i = 0; i < encrypted.length; i++) {
        decrypted += String.fromCharCode(encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length))
      }
      return JSON.parse(decrypted)
    } catch {
      return null
    }
  }
}

// Global instances
const secureStorage = new SecureStorage()
const tokenManager = new TokenManager()

// Export for use in auth.ts
export { tokenManager }

// Convert relative URLs to absolute in Node.js test environment (only when TEST_API_CLIENT env var is set)
const getApiUrl = (endpoint: string): string => {
  const fullPath = config.api.basePath + endpoint
  // Only convert if TEST_API_CLIENT env var is set (only for API client tests)
  if (fullPath.startsWith('/') && typeof process !== 'undefined' && process.env.TEST_API_CLIENT === 'true') {
    return `http://localhost${fullPath}`
  }
  return fullPath
}

// ============================================================================
// RATE LIMITING
// ============================================================================

class RateLimiter {
  private state: RateLimitState = {
    requests: 0,
    resetTime: Date.now() + RATE_LIMIT_WINDOW
  }

  checkLimit(): boolean {
    const now = Date.now()

    // Reset counter if window has passed
    if (now >= this.state.resetTime) {
      this.state.requests = 0
      this.state.resetTime = now + RATE_LIMIT_WINDOW
    }

    // Check if under limit
    if (this.state.requests >= MAX_REQUESTS_PER_WINDOW) {
      return false
    }

    this.state.requests++
    return true
  }

  getRemainingRequests(): number {
    return Math.max(0, MAX_REQUESTS_PER_WINDOW - this.state.requests)
  }

  getResetTime(): number {
    return this.state.resetTime
  }
}

const rateLimiter = new RateLimiter()

// ============================================================================
// REQUEST/RESPONSE INTERCEPTORS
// ============================================================================

interface RequestInterceptor {
  (url: string, options: RequestInit): Promise<RequestInit> | RequestInit
}

interface ResponseInterceptor {
  (response: Response, data?: unknown): Promise<unknown> | unknown
}

class InterceptorManager {
  private requestInterceptors: RequestInterceptor[] = []
  private responseInterceptors: ResponseInterceptor[] = []

  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor)
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor)
  }

  async runRequestInterceptors(url: string, options: RequestInit): Promise<RequestInit> {
    let processedOptions = { ...options }

    for (const interceptor of this.requestInterceptors) {
      processedOptions = await interceptor(url, processedOptions)
    }

    return processedOptions
  }

  async runResponseInterceptors(response: Response, data?: unknown): Promise<unknown> {
    let processedData = data

    for (const interceptor of this.responseInterceptors) {
      processedData = await interceptor(response, processedData)
    }

    return processedData
  }
}

const interceptors = new InterceptorManager()

// Default request interceptor for logging
interceptors.addRequestInterceptor(async (url, options) => {
  if (config.features.enableDebugLogging) {
    console.log(`[API Request] ${options.method || 'GET'} ${url}`, {
      headers: sanitizeHeadersForLogging(options.headers),
      body: options.body ? '[REQUEST BODY]' : undefined
    })
  }
  return options
})

// Default response interceptor for logging
interceptors.addResponseInterceptor(async (response, data) => {
  if (config.features.enableDebugLogging) {
    console.log(`[API Response] ${response.status} ${response.url}`)
  }
  return data
})

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Sanitize headers for logging (remove sensitive information)
 */
function sanitizeHeadersForLogging(headers?: HeadersInit): Record<string, string> | undefined {
  if (!headers) return undefined

  const sanitized: Record<string, string> = {}
  const headerEntries = headers instanceof Headers
    ? Array.from(headers.entries())
    : Object.entries(headers)

  for (const [key, value] of headerEntries) {
    // Never log API keys or other sensitive headers
    if (key.toLowerCase().includes('api-key') ||
        key.toLowerCase().includes('authorization') ||
        key.toLowerCase().includes('csrf')) {
      sanitized[key] = '[REDACTED]'
    } else {
      sanitized[key] = String(value)
    }
  }

  return sanitized
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  // Network errors, 5xx server errors, and specific 4xx errors are retryable
  if (error instanceof Error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return true // Network error
    }
  }

  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: number }).status
    if (status) {
      // 5xx errors are retryable
      if (status >= 500) return true
      // 429 (Too Many Requests) is retryable
      if (status === 429) return true
      // 408 (Request Timeout) is retryable
      if (status === 408) return true
    }
  }

  return false
}

/**
 * Calculate retry delay with exponential backoff
 */
function calculateRetryDelay(attempt: number): number {
  const baseDelay = config.api.retry.initialDelay
  const multiplier = config.api.retry.backoffMultiplier
  const delay = baseDelay * Math.pow(multiplier, attempt - 1)

  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delay
  return Math.min(delay + jitter, 30000) // Cap at 30 seconds
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Validate API response structure
 */
function validateApiResponse<T>(data: unknown, endpoint: string): T {
  // Basic validation - ensure we have valid data
  if (data === null || data === undefined) {
    throw new Error(`Invalid response from ${endpoint}: response is null or undefined`)
  }

  // Additional validation can be added here based on endpoint
  // For example, check required fields for specific endpoints

  return data as T
}

/**
 * Create API error with additional context
 */
function createApiError(message: string, response?: Response, originalError?: unknown): ApiError {
  const error = new Error(message) as ApiError

  if (response) {
    error.status = response.status
  }

  if (originalError && typeof originalError === 'object') {
    const err = originalError as Record<string, unknown>
    error.code = (err.code as string) || (err.error as string)
    error.details = err.details || err
  }

  return error
}

// ============================================================================
// ENHANCED FETCH FUNCTION
// ============================================================================

export async function fetchApi<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    timeout = config.api.timeout,
    skipRetry = false,
    skipAuth = false,
    ...fetchOptions
  } = options

  // Check rate limiting
  if (!rateLimiter.checkLimit()) {
    const resetTime = rateLimiter.getResetTime()
    const waitTime = resetTime - Date.now()
    throw createApiError(
      `Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`,
      undefined,
      { code: 'RATE_LIMIT_EXCEEDED' }
    )
  }

  // Get API key from token manager (with automatic refresh)
  const apiKey = skipAuth ? null : await tokenManager.refreshTokenIfNeeded().then(info => info?.token || null)

  // Build headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  }

  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }

  // CSRF token support (if available)
  const csrfToken = getCsrfToken()
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken
  }

  const url = getApiUrl(endpoint)
  let processedOptions: RequestInit = {
    ...fetchOptions,
    headers,
  }

  // Run request interceptors
  processedOptions = await interceptors.runRequestInterceptors(url, processedOptions)

  // Retry logic
  const maxAttempts = skipRetry ? 1 : config.api.retry.maxAttempts
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const retryState: RetryState = { attempt, delay: 0 }

    try {
      // Create AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        ...processedOptions,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Handle HTTP errors
      if (!response.ok) {
        // Handle 401 by clearing auth and redirecting to login
        if (response.status === 401) {
          auth.removeApiKey()
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
          throw createApiError('Unauthorized', response)
        }

        // Try to parse error response
        let errorData: Record<string, unknown> = {}
        try {
          errorData = await response.json()
        } catch {
          errorData = { error: 'Unknown error' }
        }

        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`
        const apiError = createApiError(errorMessage, response, errorData)

        // Check if error is retryable
        if (attempt < maxAttempts && isRetryableError(apiError)) {
          retryState.delay = calculateRetryDelay(attempt)
          if (config.features.enableDebugLogging) {
            console.log(`[API Retry] Attempt ${attempt} failed, retrying in ${retryState.delay}ms:`, errorMessage)
          }
          await sleep(retryState.delay)
          continue
        }

        throw apiError
      }

      // Parse response
      let data: unknown
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text()
      }

      // Validate response
      const validatedData = validateApiResponse<T>(data, endpoint)

      // Run response interceptors
      const finalData = await interceptors.runResponseInterceptors(response, validatedData)

      return finalData

    } catch (error: unknown) {
      lastError = error

      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = createApiError(`Request timeout after ${timeout}ms`, undefined, error)
        if (attempt < maxAttempts && isRetryableError(timeoutError)) {
          retryState.delay = calculateRetryDelay(attempt)
          if (config.features.enableDebugLogging) {
            console.log(`[API Retry] Timeout on attempt ${attempt}, retrying in ${retryState.delay}ms`)
          }
          await sleep(retryState.delay)
          continue
        }
        throw timeoutError
      }

      // Handle network errors
      if (error instanceof Error && error.name === 'TypeError' && error.message.includes('fetch')) {
        const networkError = createApiError('Network error', undefined, error)
        if (attempt < maxAttempts && isRetryableError(networkError)) {
          retryState.delay = calculateRetryDelay(attempt)
          if (config.features.enableDebugLogging) {
            console.log(`[API Retry] Network error on attempt ${attempt}, retrying in ${retryState.delay}ms`)
          }
          await sleep(retryState.delay)
          continue
        }
        throw networkError
      }

      // For non-retryable errors or last attempt, throw immediately
      if (!isRetryableError(error) || attempt === maxAttempts) {
        throw error
      }
    }
  }

  // This should never be reached, but just in case
  const finalError = lastError || createApiError('Request failed after all retry attempts')

  // Report the error using the global error handler
  await errorHandler.handleNetworkError(
    finalError,
    endpoint,
    fetchOptions.method || 'GET',
    (finalError as any).status
  )

  throw finalError
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
    const metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement
    if (metaTag && metaTag.content) {
      return metaTag.content
    }
  }

  // Try to get from cookie (fallback, set during login)
  if (typeof document !== 'undefined' && document.cookie) {
    const csrfCookie = document.cookie
      .split(';')
      .find(cookie => cookie.trim().startsWith('csrf_token='))
    if (csrfCookie) {
      return csrfCookie.split('=')[1]
    }
  }

  // Note: Could fall back to API call, but this would create circular dependency
  // since API calls need CSRF tokens. Better to ensure tokens are set via meta tag or cookie.
  return null
}

/**
 * Set CSRF token (called when token is received from server)
 */
export function setCsrfToken(token: string): void {
  if (typeof document !== 'undefined') {
    // Update meta tag
    let metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement
    if (!metaTag) {
      metaTag = document.createElement('meta')
      metaTag.name = 'csrf-token'
      document.head.appendChild(metaTag)
    }
    metaTag.content = token

    // Also set as cookie for fallback
    document.cookie = `csrf_token=${token}; path=/; secure; samesite=strict`
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
    await fetchApi<void>(config.api.endpoints.hostById(hostID), { method: 'DELETE' })
  },
}

// ============================================================================
// EXPORT INTERCEPTOR MANAGER FOR ADVANCED USAGE
// ============================================================================

export { interceptors }
export type { RequestInterceptor, ResponseInterceptor }

