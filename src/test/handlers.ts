import { rest } from 'msw'
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
  rest.get('/api/v1/health', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(createMockHealthResponse()))
  }),

  // Get hosts
  rest.get('/api/v1/hosts', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(createMockHostsResponse({ hosts: createMockHostsArray(3) })))
  }),

  // Get host by ID
  rest.get('/api/v1/hosts/:id', (req, res, ctx) => {
    const { id } = req.params
    const hostId = id as string
    
    // You can check if host exists and return 404 if not
    // For now, always return a mock report
    return res(
      ctx.status(200),
      ctx.json(
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
    )
  }),

  // Delete host
  rest.delete('/api/v1/hosts/:id', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({}))
  }),

  // Login
  rest.post('/api/v1/auth/login', async (req, res, ctx) => {
    const body = await req.json() as { username: string; password: string }
    
    // Return 401 for specific test scenarios
    if (body.username === 'error' || body.username === 'invalid') {
      return res(ctx.status(401), ctx.json({ error: 'Invalid credentials' }))
    }
    
    return res(
      ctx.status(200),
      ctx.json(
        createMockLoginResponse({
          token: 'mock-api-key-token-12345',
          user: createMockUser({ username: body.username }),
        })
      )
    )
  }),

  // Register
  rest.post('/api/v1/auth/register', async (req, res, ctx) => {
    const body = await req.json() as { username: string; email: string; password: string; org_name: string }
    
    // Return error for duplicate username
    if (body.username === 'existing') {
      return res(ctx.status(400), ctx.json({ error: 'Username already exists' }))
    }
    
    return res(
      ctx.status(201),
      ctx.json(createMockUser({ username: body.username, email: body.email }))
    )
  }),

  // Get current user (auth/me)
  rest.get('/api/v1/auth/me', (req, res, ctx) => {
    const apiKey = req.headers.get('X-API-Key')
    
    if (!apiKey || apiKey === 'invalid') {
      return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }))
    }
    
    return res(ctx.status(200), ctx.json(createMockUser()))
  }),

  // API Keys
  rest.post('/api/v1/api-keys', async (req, res, ctx) => {
    const apiKey = req.headers.get('X-API-Key')
    
    if (!apiKey) {
      return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }))
    }
    
    const body = await req.json() as { name: string; expires_at?: string }
    
    return res(
      ctx.status(201),
      ctx.json({
        id: 'test-api-key-id-1',
        key: 'test-api-key-plain-text-' + Date.now(),
        name: body.name,
        expires_at: body.expires_at,
        created_at: new Date().toISOString(),
      })
    )
  }),

  rest.get('/api/v1/api-keys', (req, res, ctx) => {
    const apiKey = req.headers.get('X-API-Key')
    
    if (!apiKey) {
      return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }))
    }
    
    return res(
      ctx.status(200),
      ctx.json({
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
    )
  }),

  rest.delete('/api/v1/api-keys/:id', (req, res, ctx) => {
    const apiKey = req.headers.get('X-API-Key')
    
    if (!apiKey) {
      return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }))
    }
    
    return res(ctx.status(200), ctx.json({}))
  }),

  // Users (admin endpoints)
  rest.get('/api/v1/users', (req, res, ctx) => {
    const apiKey = req.headers.get('X-API-Key')
    
    if (!apiKey) {
      return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }))
    }
    
    return res(
      ctx.status(200),
      ctx.json({
        users: [
          createMockUser({ username: 'user1', role: 'admin' }),
          createMockUser({ username: 'user2', role: 'viewer' }),
          createMockUser({ username: 'user3', role: 'editor' }),
        ],
        total: 3,
      })
    )
  }),

  rest.post('/api/v1/users', async (req, res, ctx) => {
    const apiKey = req.headers.get('X-API-Key')
    
    if (!apiKey) {
      return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }))
    }
    
    const body = await req.json() as { username: string; email: string; password: string; role: 'admin' | 'editor' | 'viewer' }
    
    return res(
      ctx.status(201),
      ctx.json(createMockUser({ username: body.username, email: body.email, role: body.role }))
    )
  }),

  rest.put('/api/v1/users/:id/role', async (req, res, ctx) => {
    const apiKey = req.headers.get('X-API-Key')
    
    if (!apiKey) {
      return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }))
    }
    
    const { id } = req.params
    const body = await req.json() as { role: 'admin' | 'editor' | 'viewer' }
    
    return res(
      ctx.status(200),
      ctx.json(createMockUser({ id: id as string, role: body.role }))
    )
  }),

  rest.delete('/api/v1/users/:id', (req, res, ctx) => {
    const apiKey = req.headers.get('X-API-Key')
    
    if (!apiKey) {
      return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }))
    }
    
    return res(ctx.status(200), ctx.json({}))
  }),
]

