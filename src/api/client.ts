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
  
  // Get full host data (returns the complete report) by host_id (UUID)
  getHost: (hostID: string) => fetchApi<Report>(`/hosts/${hostID}`),
  
  // Delete a host by host_id (UUID)
  deleteHost: async (hostID: string) => {
    const response = await fetch(`${API_BASE}/hosts/${hostID}`, { method: 'DELETE' })
    if (!response.ok) {
      throw new Error(`Failed to delete host: ${response.status}`)
    }
  },
}

