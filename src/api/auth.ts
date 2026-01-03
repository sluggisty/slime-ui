// Auth API client functions
import type { LoginRequest, LoginResponse, RegisterRequest, User, CreateAPIKeyRequest, CreateAPIKeyResponse, APIKey } from '../types'

const API_BASE = '/api/v1'

// Convert relative URLs to absolute in Node.js test environment (only when TEST_API_CLIENT env var is set)
const getApiUrl = (endpoint: string): string => {
  const fullPath = `${API_BASE}${endpoint}`
  // Only convert if TEST_API_CLIENT env var is set (only for API client tests)
  if (fullPath.startsWith('/') && typeof process !== 'undefined' && process.env.TEST_API_CLIENT === 'true') {
    return `http://localhost${fullPath}`
  }
  return fullPath
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const apiKey = localStorage.getItem('api_key')
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  
  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }

  const response = await fetch(getApiUrl(endpoint), {
    ...options,
    headers,
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }
  
  return response.json()
}

export const authApi = {
  // Register a new user
  register: (data: RegisterRequest) => 
    fetchApi<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Login and get API key
  login: (data: LoginRequest) =>
    fetchApi<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Get current user info
  getMe: () => fetchApi<User>('/auth/me'),

  // API Key management
  createAPIKey: (data: CreateAPIKeyRequest) =>
    fetchApi<CreateAPIKeyResponse>('/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listAPIKeys: () => fetchApi<{ api_keys: APIKey[], total: number }>('/api-keys'),

  deleteAPIKey: async (id: string) => {
    const response = await fetch(getApiUrl(`/api-keys/${id}`), {
      method: 'DELETE',
      headers: {
        'X-API-Key': localStorage.getItem('api_key') || '',
      },
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `Failed to delete API key: ${response.status}`)
    }
  },
}

// Auth utilities
export const auth = {
  setApiKey: (apiKey: string) => {
    localStorage.setItem('api_key', apiKey)
  },

  getApiKey: (): string | null => {
    return localStorage.getItem('api_key')
  },

  removeApiKey: () => {
    localStorage.removeItem('api_key')
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('api_key')
  },
}



