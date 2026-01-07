import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchApi,
  ApiError,
  NetworkError,
  TimeoutError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ServerError
} from './client'
import { errorHandler } from '../utils/errorHandler'

// Mock the error handler
vi.mock('../utils/errorHandler', () => ({
  errorHandler: {
    handleNetworkError: vi.fn().mockResolvedValue(undefined)
  }
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock AbortController
global.AbortController = vi.fn().mockImplementation(() => ({
  signal: {},
  abort: vi.fn()
}))

describe('API Client - Enhanced Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Typed Error Classes', () => {
    it('creates ApiError with proper context', () => {
      const error = new ApiError('Test error', 404, 'NOT_FOUND', { extra: 'data' }, false, {
        url: '/test',
        method: 'GET',
        userId: 'user123',
        sessionId: 'session456',
        requestId: 'req789'
      })

      expect(error.message).toBe('Test error')
      expect(error.status).toBe(404)
      expect(error.code).toBe('NOT_FOUND')
      expect(error.details).toEqual({ extra: 'data' })
      expect(error.retryable).toBe(false)
      expect(error.context?.url).toBe('/test')
      expect(error.category).toBe('client_error')
    })

    it('NetworkError is retryable', () => {
      const error = new NetworkError('Connection failed')
      expect(error.retryable).toBe(true)
      expect(error.category).toBe('network_error')
      expect(error.getUserMessage()).toBe('Connection problem. Please check your internet connection and try again.')
    })

    it('TimeoutError has proper timeout details', () => {
      const error = new TimeoutError(5000)
      expect(error.status).toBe(408)
      expect(error.code).toBe('TIMEOUT_ERROR')
      expect(error.details).toEqual({ timeout: 5000 })
      expect(error.retryable).toBe(true)
      expect(error.getUserMessage()).toBe('The request took too long to complete. Please try again.')
    })

    it('ValidationError handles field errors', () => {
      const validationErrors = {
        email: ['Invalid format'],
        password: ['Too short', 'Missing number']
      }
      const error = new ValidationError('Validation failed', validationErrors)

      expect(error.status).toBe(422)
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.validationErrors).toEqual(validationErrors)
      expect(error.getFieldErrors('email')).toEqual(['Invalid format'])
      expect(error.getAllErrors()).toHaveLength(3)
      expect(error.getUserMessage()).toContain('correct the errors')
    })

    it('AuthenticationError has proper messaging', () => {
      const error = new AuthenticationError()
      expect(error.status).toBe(401)
      expect(error.code).toBe('AUTHENTICATION_ERROR')
      expect(error.getUserMessage()).toBe('Your session has expired. Please sign in again.')
    })

    it('AuthorizationError has proper messaging', () => {
      const error = new AuthorizationError()
      expect(error.status).toBe(403)
      expect(error.code).toBe('AUTHORIZATION_ERROR')
      expect(error.getUserMessage()).toBe('You don\'t have permission to perform this action.')
    })

    it('RateLimitError calculates reset time', () => {
      const resetTime = Date.now() + 30000 // 30 seconds from now
      const error = new RateLimitError('Rate limited', resetTime)

      expect(error.status).toBe(429)
      expect(error.code).toBe('RATE_LIMIT_ERROR')
      expect(error.resetTime).toBe(resetTime)
      expect(error.getSecondsUntilReset()).toBeGreaterThan(25)
      expect(error.getUserMessage()).toContain('seconds')
    })

    it('ServerError for 5xx responses', () => {
      const error = new ServerError('Internal server error', 500)
      expect(error.status).toBe(500)
      expect(error.code).toBe('SERVER_ERROR')
      expect(error.retryable).toBe(true)
      expect(error.getUserMessage()).toContain('experiencing issues')
    })
  })

  describe('Error Factory Function', () => {
    it('creates AuthenticationError for 401', () => {
      const mockResponse = { status: 401, url: 'http://api.example.com/test' } as Response
      const error = (global as any).createApiError('Unauthorized', mockResponse)

      expect(error).toBeInstanceOf(AuthenticationError)
      expect(error.status).toBe(401)
    })

    it('creates AuthorizationError for 403', () => {
      const mockResponse = { status: 403, url: 'http://api.example.com/test' } as Response
      const error = (global as any).createApiError('Forbidden', mockResponse)

      expect(error).toBeInstanceOf(AuthorizationError)
      expect(error.status).toBe(403)
    })

    it('creates ValidationError for 422', () => {
      const mockResponse = { status: 422, url: 'http://api.example.com/test' } as Response
      const error = (global as any).createApiError('Validation failed', mockResponse)

      expect(error).toBeInstanceOf(ValidationError)
      expect(error.status).toBe(422)
    })

    it('creates RateLimitError for 429', () => {
      const mockResponse = {
        status: 429,
        url: 'http://api.example.com/test',
        headers: { get: () => '30' }
      } as any
      const error = (global as any).createApiError('Rate limited', mockResponse)

      expect(error).toBeInstanceOf(RateLimitError)
      expect(error.status).toBe(429)
    })

    it('creates ServerError for 5xx', () => {
      const mockResponse = { status: 500, url: 'http://api.example.com/test' } as Response
      const error = (global as any).createApiError('Server error', mockResponse)

      expect(error).toBeInstanceOf(ServerError)
      expect(error.status).toBe(500)
    })

    it('creates NetworkError for fetch failures', () => {
      const originalError = new TypeError('Failed to fetch')
      const error = (global as any).createApiError('Network error', undefined, originalError)

      expect(error).toBeInstanceOf(NetworkError)
      expect(error.retryable).toBe(true)
    })
  })

  describe('Enhanced fetchApi Error Handling', () => {
    it('handles 401 responses with auth clearing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        url: 'http://api.example.com/test',
        json: () => Promise.resolve({ error: 'Invalid token' })
      })

      await expect(fetchApi('/test')).rejects.toThrow(AuthenticationError)
      expect(errorHandler.handleNetworkError).toHaveBeenCalled()
    })

    it('handles timeout errors with retry', async () => {
      // Mock AbortController to trigger timeout
      const mockController = {
        signal: {},
        abort: vi.fn()
      }
      global.AbortController = vi.fn().mockImplementation(() => mockController)

      // First call times out
      mockFetch.mockImplementationOnce(() => {
        // Simulate timeout by calling abort
        setTimeout(() => mockController.abort(), 100)
        return new Promise(() => {}) // Never resolves
      })

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true })
      })

      const result = await fetchApi('/test', { timeout: 50, skipAuth: true })
      expect(result).toEqual({ success: true })
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('handles network errors with retry', async () => {
      // First call fails with network error
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true })
      })

      const result = await fetchApi('/test', { skipAuth: true })
      expect(result).toEqual({ success: true })
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('respects retry configuration', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(fetchApi('/test', {
        skipAuth: true,
        retryConfig: {
          maxRetries: 2,
          retryDelay: 10
        }
      })).rejects.toThrow(NetworkError)

      expect(mockFetch).toHaveBeenCalledTimes(3) // initial + 2 retries
    })

    it('handles validation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        url: 'http://api.example.com/test',
        json: () => Promise.resolve({
          error: 'Validation failed',
          details: {
            email: ['Invalid format'],
            password: ['Too short']
          }
        })
      })

      await expect(fetchApi('/test', { skipAuth: true })).rejects.toThrow(ValidationError)
    })

    it('handles rate limiting', async () => {
      // Mock rate limiter to return false
      const rateLimiter = (global as any).rateLimiter
      rateLimiter.checkLimit = vi.fn().mockReturnValue(false)
      rateLimiter.getResetTime = vi.fn().mockReturnValue(Date.now() + 30000)

      await expect(fetchApi('/test')).rejects.toThrow(RateLimitError)
    })

    it('includes request context in errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        url: 'http://api.example.com/test',
        json: () => Promise.resolve({ error: 'Server error' })
      })

      try {
        await fetchApi('/test', { method: 'POST', skipAuth: true })
      } catch (error) {
        expect(error).toBeInstanceOf(ServerError)
        expect((error as ServerError).context?.method).toBe('POST')
        expect((error as ServerError).context?.url).toMatch(/\/test$/)
        expect((error as ServerError).context?.requestId).toBeDefined()
      }
    })

    it('tracks request duration', async () => {
      vi.useFakeTimers()

      mockFetch.mockImplementationOnce(() => {
        vi.advanceTimersByTime(150) // Simulate 150ms request
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          url: 'http://api.example.com/test',
          json: () => Promise.resolve({ error: 'Not found' })
        })
      })

      try {
        await fetchApi('/test', { skipAuth: true })
      } catch (error) {
        expect((error as ApiError).context?.duration).toBeGreaterThanOrEqual(150)
      }
    })

    it('handles malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        url: 'http://api.example.com/test',
        json: () => Promise.reject(new Error('Invalid JSON'))
      })

      await expect(fetchApi('/test', { skipAuth: true })).rejects.toThrow(ApiError)
    })

    it('respects skipRetry option', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(fetchApi('/test', {
        skipAuth: true,
        skipRetry: true
      })).rejects.toThrow(NetworkError)

      expect(mockFetch).toHaveBeenCalledTimes(1) // No retries
    })
  })

  describe('Error Recovery Strategies', () => {
    it('implements exponential backoff for retries', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

      const startTime = Date.now()

      await expect(fetchApi('/test', {
        skipAuth: true,
        retryConfig: {
          maxRetries: 3,
          retryDelay: 100,
          exponentialBackoff: true
        }
      })).rejects.toThrow(NetworkError)

      const elapsed = Date.now() - startTime
      // Should have delays: 100ms, 200ms, 400ms = 700ms total
      expect(elapsed).toBeGreaterThan(600)
    })

    it('respects custom retryable status codes', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 418, // I'm a teapot - not normally retryable
        statusText: 'I\'m a teapot',
        url: 'http://api.example.com/test',
        json: () => Promise.resolve({ error: 'Teapot' })
      })

      // Should retry 418 with custom config
      await expect(fetchApi('/test', {
        skipAuth: true,
        retryConfig: {
          maxRetries: 2,
          retryableStatuses: [418]
        }
      })).rejects.toThrow(ApiError)

      expect(mockFetch).toHaveBeenCalledTimes(3) // initial + 2 retries
    })

    it('does not retry non-retryable errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        url: 'http://api.example.com/test',
        json: () => Promise.resolve({ error: 'Bad request' })
      })

      await expect(fetchApi('/test', { skipAuth: true })).rejects.toThrow(ApiError)
      expect(mockFetch).toHaveBeenCalledTimes(1) // No retries for 400
    })
  })

  describe('User-Friendly Messages', () => {
    it('provides appropriate messages for different error types', () => {
      expect(new NetworkError('').getUserMessage()).toContain('connection')
      expect(new AuthenticationError().getUserMessage()).toContain('session')
      expect(new AuthorizationError().getUserMessage()).toContain('permission')
      expect(new ServerError('', 500).getUserMessage()).toContain('issues')
      expect(new TimeoutError(5000).getUserMessage()).toContain('too long')
      expect(new RateLimitError('', Date.now() + 30000).getUserMessage()).toContain('wait')
    })

    it('handles validation error messages', () => {
      const error = new ValidationError('Validation failed', {
        field1: ['Error 1'],
        field2: ['Error 2', 'Error 3']
      })

      const message = error.getUserMessage()
      expect(message).toContain('correct the errors') // Plural for multiple fields
    })
  })

  describe('Error Serialization', () => {
    it('converts errors to JSON for logging', () => {
      const error = new ApiError('Test', 404, 'NOT_FOUND', { test: true }, false, {
        url: '/test',
        method: 'GET',
        requestId: 'req123'
      })

      const json = error.toJSON()

      expect(json.name).toBe('ApiError')
      expect(json.message).toBe('Test')
      expect(json.status).toBe(404)
      expect(json.context?.url).toBe('/test')
    })
  })
})