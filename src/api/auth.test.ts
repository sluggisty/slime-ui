import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { authApi, auth } from './auth'
import { server } from '../test/server'
import { http, HttpResponse } from 'msw'
import { createMockUser, createMockLoginResponse } from '../test/mockData'

// Set env var to enable absolute URL conversion in auth.ts (only for this test file)
beforeAll(() => {
  process.env.TEST_API_CLIENT = 'true'
})

afterAll(() => {
  delete process.env.TEST_API_CLIENT
})

// MSW handlers need to use absolute URLs for Node.js fetch compatibility
const BASE_URL = 'http://localhost'

describe('Auth API', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  describe('authApi.login', () => {
    it('sends correct request with credentials', async () => {
      const loginData = {
        username: 'testuser',
        password: 'testpass123',
      }

      let capturedBody: { username: string; password: string } | null = null
      server.use(
        http.post(`${BASE_URL}/api/v1/auth/login`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json(
            createMockLoginResponse({
              token: 'test-token-123',
              user: createMockUser({ username: loginData.username }),
            })
          )
        })
      )

      const result = await authApi.login(loginData)

      expect(capturedBody).toEqual(loginData)
      expect(result).toHaveProperty('token')
      expect(result).toHaveProperty('user')
      expect(result.user.username).toBe(loginData.username)
    })

    it('handles login errors', async () => {
      server.use(
        http.post(`${BASE_URL}/api/v1/auth/login`, () => {
          return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
        })
      )

      await expect(
        authApi.login({ username: 'invalid', password: 'wrong' })
      ).rejects.toThrow('Invalid credentials')
    })
  })

  describe('authApi.register', () => {
    it('sends correct request with registration data', async () => {
      const registerData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        org_name: 'Test Org',
      }

      let capturedBody: { username: string; password: string } | null = null
      server.use(
        http.post(`${BASE_URL}/api/v1/auth/register`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json(
            createMockUser({
              username: registerData.username,
              email: registerData.email,
            }),
            { status: 201 }
          )
        })
      )

      const result = await authApi.register(registerData)

      expect(capturedBody).toEqual(registerData)
      expect(result).toHaveProperty('username', registerData.username)
      expect(result).toHaveProperty('email', registerData.email)
    })

    it('handles registration errors', async () => {
      server.use(
        http.post(`${BASE_URL}/api/v1/auth/register`, () => {
          return HttpResponse.json({ error: 'Username already exists' }, { status: 400 })
        })
      )

      await expect(
        authApi.register({
          username: 'existing',
          email: 'existing@example.com',
          password: 'password123',
          org_name: 'Test Org',
        })
      ).rejects.toThrow('Username already exists')
    })
  })

  describe('auth utilities', () => {
    it('setApiKey stores the key in localStorage', () => {
      const testKey = 'test-api-key-12345'
      
      auth.setApiKey(testKey)
      
      expect(localStorage.getItem('api_key')).toBe(testKey)
    })

    it('getApiKey retrieves the key from localStorage', () => {
      const testKey = 'test-api-key-12345'
      localStorage.setItem('api_key', testKey)
      
      const retrievedKey = auth.getApiKey()
      
      expect(retrievedKey).toBe(testKey)
    })

    it('getApiKey returns null when no key is set', () => {
      localStorage.removeItem('api_key')
      
      const retrievedKey = auth.getApiKey()
      
      expect(retrievedKey).toBeNull()
    })

    it('removeApiKey removes the key from localStorage', () => {
      const testKey = 'test-api-key-12345'
      localStorage.setItem('api_key', testKey)
      
      auth.removeApiKey()
      
      expect(localStorage.getItem('api_key')).toBeNull()
    })

    it('isAuthenticated returns true when key is set', () => {
      auth.setApiKey('test-key')
      
      expect(auth.isAuthenticated()).toBe(true)
    })

    it('isAuthenticated returns false when no key is set', () => {
      auth.removeApiKey()
      
      expect(auth.isAuthenticated()).toBe(false)
    })
  })
})

