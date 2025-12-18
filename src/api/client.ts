import type { 
  Report, 
  HostsResponse,
  HealthResponse
} from '../types'

const API_BASE = '/api/v1'

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`)
  
  if (!response.ok) {
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
  
  // Get full host data (returns the complete report)
  getHost: (hostname: string) => fetchApi<Report>(`/hosts/${hostname}`),
  
  // Delete a host
  deleteHost: async (hostname: string) => {
    const response = await fetch(`${API_BASE}/hosts/${hostname}`, { method: 'DELETE' })
    if (!response.ok) {
      throw new Error(`Failed to delete host: ${response.status}`)
    }
  },
}

