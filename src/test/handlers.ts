import { http, HttpResponse } from 'msw'
import {
  createMockHostsArray,
  createMockHostsResponse,
  createMockReport,
  createMockLoginResponse,
  createMockUser,
  createMockHealthResponse,
} from './mockData'

export const handlers = [
  // Health check
  http.get('/api/v1/health', () => {
    return HttpResponse.json(createMockHealthResponse())
  }),

  // Get hosts
  http.get('/api/v1/hosts', () => {
    return HttpResponse.json(createMockHostsResponse({ hosts: createMockHostsArray(3) }))
  }),

  // Get host by ID
  http.get('/api/v1/hosts/:id', ({ params }) => {
    const { id } = params
    const hostId = id as string
    
    // You can check if host exists and return 404 if not
    // For now, always return a mock report
    return HttpResponse.json(
      createMockReport({
        meta: {
          host_id: hostId,
          hostname: `test-host-${hostId.slice(0, 8)}`,
          collection_id: 'test-collection-1',
          timestamp: new Date().toISOString(),
          snail_version: '1.0.0',
        },
      })
    )
  }),

  // Delete host
  http.delete('/api/v1/hosts/:id', () => {
    return HttpResponse.json({})
  }),

  // Login
  http.post('/api/v1/auth/login', async ({ request }) => {
    const body = await request.json() as { username: string; password: string }
    
    // Return 401 for specific test scenarios
    if (body.username === 'error' || body.username === 'invalid') {
      return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    
    return HttpResponse.json(
      createMockLoginResponse({
        token: 'mock-api-key-token-12345',
        user: createMockUser({ username: body.username }),
      })
    )
  }),

  // Register
  http.post('/api/v1/auth/register', async ({ request }) => {
    const body = await request.json() as { username: string; email: string; password: string; org_name: string }
    
    // Return error for duplicate username
    if (body.username === 'existing') {
      return HttpResponse.json({ error: 'Username already exists' }, { status: 400 })
    }
    
    return HttpResponse.json(
      createMockUser({ username: body.username, email: body.email }),
      { status: 201 }
    )
  }),

  // Get current user (auth/me)
  http.get('/api/v1/auth/me', ({ request }) => {
    const apiKey = request.headers.get('X-API-Key')
    
    if (!apiKey || apiKey === 'invalid') {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    return HttpResponse.json(createMockUser())
  }),

  // API Keys
  http.post('/api/v1/api-keys', async ({ request }) => {
    const apiKey = request.headers.get('X-API-Key')
    
    if (!apiKey) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json() as { name: string; expires_at?: string }
    
    return HttpResponse.json(
      {
        id: 'test-api-key-id-1',
        key: 'test-api-key-plain-text-' + Date.now(),
        name: body.name,
        expires_at: body.expires_at,
        created_at: new Date().toISOString(),
      },
      { status: 201 }
    )
  }),

  http.get('/api/v1/api-keys', ({ request }) => {
    const apiKey = request.headers.get('X-API-Key')
    
    if (!apiKey) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    return HttpResponse.json({
      api_keys: [
        {
          id: 'test-api-key-id-1',
          user_id: 'test-user-id-1',
          name: 'Test API Key',
          last_used_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ],
      total: 1,
    })
  }),

  http.delete('/api/v1/api-keys/:id', ({ request }) => {
    const apiKey = request.headers.get('X-API-Key')
    
    if (!apiKey) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    return HttpResponse.json({})
  }),

  // Users (admin endpoints)
  http.get('/api/v1/users', ({ request }) => {
    const apiKey = request.headers.get('X-API-Key')
    
    if (!apiKey) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    return HttpResponse.json({
      users: [
        createMockUser({ username: 'user1', role: 'admin' }),
        createMockUser({ username: 'user2', role: 'viewer' }),
        createMockUser({ username: 'user3', role: 'editor' }),
      ],
      total: 3,
    })
  }),

  http.post('/api/v1/users', async ({ request }) => {
    const apiKey = request.headers.get('X-API-Key')
    
    if (!apiKey) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json() as { username: string; email: string; password: string; role: 'admin' | 'editor' | 'viewer' }
    
    return HttpResponse.json(
      createMockUser({ username: body.username, email: body.email, role: body.role }),
      { status: 201 }
    )
  }),

  http.put('/api/v1/users/:id/role', async ({ params, request }) => {
    const apiKey = request.headers.get('X-API-Key')
    
    if (!apiKey) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { id } = params
    const body = await request.json() as { role: 'admin' | 'editor' | 'viewer' }
    
    return HttpResponse.json(createMockUser({ id: id as string, role: body.role }))
  }),

  http.delete('/api/v1/users/:id', ({ request }) => {
    const apiKey = request.headers.get('X-API-Key')
    
    if (!apiKey) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    return HttpResponse.json({})
  }),
]

