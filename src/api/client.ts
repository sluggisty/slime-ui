import type { 
  Report, 
  HostsResponse,
  HealthResponse
} from '../types'
import { auth } from './auth'

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

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const apiKey = auth.getApiKey()
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers as HeadersInit,
  }
  
  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }

  const response = await fetch(getApiUrl(endpoint), {
    ...options,
    headers,
  })
  
  if (!response.ok) {
    // Handle 401 by clearing auth and redirecting to login
    if (response.status === 401) {
      auth.removeApiKey()
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }
    
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }
  
  return response.json()
}

export const api = {
  // Health check
  getHealth: () => fetchApi<HealthResponse>('/health'),
  
  // Hosts
  getHosts: () => fetchApi<HostsResponse>('/hosts'),
  
  // Get full host data (returns the complete report) by host_id (UUID)
  getHost: (hostID: string) => fetchApi<Report>(`/hosts/${hostID}`),
  
  // Delete a host by host_id (UUID)
  deleteHost: async (hostID: string) => {
    await fetchApi<void>(`/hosts/${hostID}`, { method: 'DELETE' })
  },
}

