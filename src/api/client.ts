import type {
  Report,
  HostsResponse,
  HealthResponse
} from '../types'
import { config } from '../config/config'
import { auth } from './auth'

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

  // Get API key if not skipping auth
  const apiKey = skipAuth ? null : auth.getApiKey()

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
  throw lastError || createApiError('Request failed after all retry attempts')
}

// ============================================================================
// CSRF TOKEN MANAGEMENT
// ============================================================================

/**
 * Get CSRF token from meta tag or cookie
 * This should be set by the backend and available in the HTML
 */
function getCsrfToken(): string | null {
  // Try to get from meta tag first
  if (typeof document !== 'undefined') {
    const metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement
    if (metaTag && metaTag.content) {
      return metaTag.content
    }
  }

  // Try to get from cookie (fallback)
  if (typeof document !== 'undefined' && document.cookie) {
    const csrfCookie = document.cookie
      .split(';')
      .find(cookie => cookie.trim().startsWith('csrf_token='))
    if (csrfCookie) {
      return csrfCookie.split('=')[1]
    }
  }

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

