import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'

// Set env var to enable absolute URL conversion in client.ts (only for this test file)
beforeAll(() => {
  process.env.TEST_API_CLIENT = 'true'
})

afterAll(() => {
  delete process.env.TEST_API_CLIENT
})

import { api, fetchApi } from './client'
import { auth } from './auth'
import { server } from '../test/server'
import { http, HttpResponse } from 'msw'
import { createMockHostsResponse, createMockReport, createMockHealthResponse } from '../test/mockData'

// Mock window.location
const mockLocation = {
  href: '',
}
delete (window as { location?: Location }).location
window.location = mockLocation as Location

// For this test file only, we use absolute URLs in handlers because Node.js fetch requires them
// Other tests can continue using relative URLs because they work differently
const BASE_URL = 'http://localhost'

describe('API Client', () => {
  beforeEach(() => {
    auth.removeApiKey()
    vi.clearAllMocks()
    mockLocation.href = ''
  })

  describe('fetchApi', () => {
    it('adds API key to headers when available', async () => {
      auth.setApiKey('test-api-key-123')
      
      server.use(
        http.get(`${BASE_URL}/api/v1/health`, async ({ request }) => {
          const apiKey = request.headers.get('X-API-Key')
          expect(apiKey).toBe('test-api-key-123')
          return HttpResponse.json(createMockHealthResponse())
        })
      )

      await fetchApi('/health')
    })

    it('does not add API key to headers when not available', async () => {
      auth.removeApiKey()
      
      server.use(
        http.get(`${BASE_URL}/api/v1/health`, async ({ request }) => {
          const apiKey = request.headers.get('X-API-Key')
          expect(apiKey).toBeNull()
          return HttpResponse.json(createMockHealthResponse())
        })
      )

      await fetchApi('/health')
    })

    it('handles successful responses', async () => {
      const mockData = createMockHealthResponse()
      server.use(
        http.get(`${BASE_URL}/api/v1/health`, () => {
          return HttpResponse.json(mockData)
        })
      )

      const result = await fetchApi('/health')
      expect(result).toEqual(mockData)
    })

    it('handles 401 errors and redirects to login', async () => {
      auth.setApiKey('invalid-key')
      
      server.use(
        http.get(`${BASE_URL}/api/v1/health`, () => {
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
        })
      )

      await expect(fetchApi('/health')).rejects.toThrow('Unauthorized')
      expect(auth.getApiKey()).toBeNull()
      expect(window.location.href).toBe('/login')
    })

    it('handles other error status codes', async () => {
      server.use(
        http.get(`${BASE_URL}/api/v1/health`, () => {
          return HttpResponse.json({ error: 'Server error' }, { status: 500 })
        })
      )

      await expect(fetchApi('/health')).rejects.toThrow('Server error')
    })

    it('handles error responses without error message', async () => {
      server.use(
        http.get(`${BASE_URL}/api/v1/health`, () => {
          return HttpResponse.json({}, { status: 500 })
        })
      )

      await expect(fetchApi('/health')).rejects.toThrow('HTTP 500')
    })

    it('preserves custom headers', async () => {
      auth.setApiKey('test-key')
      
      server.use(
        http.get(`${BASE_URL}/api/v1/health`, async ({ request }) => {
          const customHeader = request.headers.get('Custom-Header')
          expect(customHeader).toBe('custom-value')
          const apiKey = request.headers.get('X-API-Key')
          expect(apiKey).toBe('test-key')
          return HttpResponse.json(createMockHealthResponse())
        })
      )

      await fetchApi('/health', {
        headers: {
          'Custom-Header': 'custom-value',
        },
      })
    })

    it('handles non-JSON error responses', async () => {
      server.use(
        http.get(`${BASE_URL}/api/v1/health`, () => {
          return HttpResponse.text('Not Found', { status: 404 })
        })
      )

      await expect(fetchApi('/health')).rejects.toThrow()
    })
  })

  describe('api methods', () => {
    it('getHealth returns correct data', async () => {
      const mockHealth = createMockHealthResponse()
      server.use(
        http.get(`${BASE_URL}/api/v1/health`, () => {
          return HttpResponse.json(mockHealth)
        })
      )

      const result = await api.getHealth()
      expect(result).toEqual(mockHealth)
    })

    it('getHosts returns hosts array', async () => {
      const mockHostsResponse = createMockHostsResponse({ hosts: [] })
      server.use(
        http.get(`${BASE_URL}/api/v1/hosts`, () => {
          return HttpResponse.json(mockHostsResponse)
        })
      )

      const result = await api.getHosts()
      expect(result).toHaveProperty('hosts')
      expect(Array.isArray(result.hosts)).toBe(true)
      expect(result).toHaveProperty('total')
    })

    it('getHost returns host data for given ID', async () => {
      const hostId = 'test-host-id-123'
      const mockReport = createMockReport({
        meta: {
          host_id: hostId,
          hostname: 'test-host',
          collection_id: 'collection-1',
          timestamp: new Date().toISOString(),
          snail_version: '1.0.0',
        },
      })

      server.use(
        http.get(`${BASE_URL}/api/v1/hosts/${hostId}`, () => {
          return HttpResponse.json(mockReport)
        })
      )

      const result = await api.getHost(hostId)
      expect(result).toHaveProperty('meta')
      expect(result.meta.host_id).toBe(hostId)
    })

    it('deleteHost sends DELETE request', async () => {
      const hostId = 'test-host-id-123'
      let deleteCalled = false

      server.use(
        http.delete(`${BASE_URL}/api/v1/hosts/${hostId}`, () => {
          deleteCalled = true
          return HttpResponse.json({})
        })
      )

      await api.deleteHost(hostId)
      expect(deleteCalled).toBe(true)
    })

    it('deleteHost handles errors', async () => {
      const hostId = 'test-host-id-123'

      server.use(
        http.delete(`${BASE_URL}/api/v1/hosts/${hostId}`, () => {
          return HttpResponse.json({ error: 'Host not found' }, { status: 404 })
        })
      )

      await expect(api.deleteHost(hostId)).rejects.toThrow()
    })
  })
})

