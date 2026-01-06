// Auth API client functions with enhanced security
import type { LoginRequest, LoginResponse, RegisterRequest, User, CreateAPIKeyRequest, CreateAPIKeyResponse, APIKey } from '../types'
import { fetchApi, setCsrfToken } from './client'
import { config } from '../config/config'

// ============================================================================
// AUTH API METHODS
// ============================================================================

export const authApi = {
  // Register a new user
  register: (data: RegisterRequest) =>
    fetchApi<User>(config.api.endpoints.auth.register, {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true, // Registration doesn't require auth
      timeout: 15000, // Shorter timeout for auth operations
    }),

  // Login and get API key
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await fetchApi<LoginResponse>(config.api.endpoints.auth.login, {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true, // Login doesn't require existing auth
      timeout: 15000, // Shorter timeout for auth operations
    })

    // Extract and store CSRF token if provided
    if (response.csrf_token) {
      setCsrfToken(response.csrf_token)
    }

    return response
  },

  // Get current user info
  getMe: () => fetchApi<User>(config.api.endpoints.auth.me, {
    timeout: 10000, // Shorter timeout for user info
  }),

  // API Key management
  createAPIKey: (data: CreateAPIKeyRequest) =>
    fetchApi<CreateAPIKeyResponse>(config.api.endpoints.apiKeys, {
      method: 'POST',
      body: JSON.stringify(data),
      timeout: 15000,
    }),

  listAPIKeys: () => fetchApi<{ api_keys: APIKey[], total: number }>(config.api.endpoints.apiKeys, {
    timeout: 10000,
  }),

  deleteAPIKey: async (id: string) => {
    await fetchApi<void>(`${config.api.endpoints.apiKeys}/${id}`, {
      method: 'DELETE',
      timeout: 10000,
    })
  },

  // User management (if backend supports it)
  listUsers: () => fetchApi<{ users: User[], total: number }>(config.api.endpoints.users, {
    timeout: 10000,
  }),
}

// ============================================================================
// SECURE AUTH UTILITIES
// ============================================================================

/**
 * Secure storage for sensitive data
 * In production, consider using more secure storage mechanisms
 */
class SecureStorage {
  private readonly keyPrefix = 'slime_ui_auth_'

  set(key: string, value: string): void {
    try {
      // In a real production app, you might want to encrypt this
      // For now, we'll use localStorage with a prefix to avoid conflicts
      localStorage.setItem(this.keyPrefix + key, value)
    } catch (error) {
      console.error('Failed to store auth data:', error)
      throw new Error('Unable to store authentication data')
    }
  }

  get(key: string): string | null {
    try {
      return localStorage.getItem(this.keyPrefix + key)
    } catch (error) {
      console.error('Failed to retrieve auth data:', error)
      return null
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.keyPrefix + key)
    } catch (error) {
      console.error('Failed to remove auth data:', error)
    }
  }

  clear(): void {
    try {
      // Clear all auth-related keys
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.keyPrefix))
      keys.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.error('Failed to clear auth data:', error)
    }
  }
}

const secureStorage = new SecureStorage()

// Auth utilities with enhanced security
export const auth = {
  /**
   * Store API key securely
   */
  setApiKey: (apiKey: string) => {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Invalid API key provided')
    }

    // Validate API key format (basic check)
    if (apiKey.length < 10) {
      throw new Error('API key appears to be invalid')
    }

    secureStorage.set('api_key', apiKey)

    if (config.features.enableDebugLogging) {
      console.log('[Auth] API key stored securely')
    }
  },

  /**
   * Get API key from secure storage
   */
  getApiKey: (): string | null => {
    const apiKey = secureStorage.get('api_key')

    // Never log the actual API key
    if (config.features.enableDebugLogging) {
      console.log('[Auth] API key retrieved:', apiKey ? '[REDACTED]' : 'null')
    }

    return apiKey
  },

  /**
   * Remove API key and clear all auth data
   */
  removeApiKey: () => {
    secureStorage.clear()

    if (config.features.enableDebugLogging) {
      console.log('[Auth] API key and auth data cleared')
    }
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: (): boolean => {
    const apiKey = secureStorage.get('api_key')
    const isAuth = !!apiKey

    if (config.features.enableDebugLogging) {
      console.log('[Auth] Authentication check:', isAuth)
    }

    return isAuth
  },

  /**
   * Store additional user session data
   */
  setUserData: (userData: Partial<User>) => {
    try {
      secureStorage.set('user_data', JSON.stringify(userData))
    } catch (error) {
      console.error('Failed to store user data:', error)
    }
  },

  /**
   * Get stored user session data
   */
  getUserData: (): Partial<User> | null => {
    try {
      const data = secureStorage.get('user_data')
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('Failed to retrieve user data:', error)
      return null
    }
  },

  /**
   * Clear all authentication data (logout)
   */
  logout: () => {
    auth.removeApiKey()

    // Clear any cached data
    if (typeof window !== 'undefined') {
      // Clear service worker caches if they exist
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            if (name.includes('auth') || name.includes('api')) {
              caches.delete(name)
            }
          })
        })
      }
    }

    if (config.features.enableDebugLogging) {
      console.log('[Auth] User logged out and caches cleared')
    }
  },

  /**
   * Validate current session (optional - call periodically)
   */
  validateSession: async (): Promise<boolean> => {
    try {
      if (!auth.isAuthenticated()) {
        return false
      }

      // Try to fetch user info to validate session
      await authApi.getMe()
      return true
    } catch (error) {
      console.warn('[Auth] Session validation failed:', error)
      auth.logout()
      return false
    }
  },
}



