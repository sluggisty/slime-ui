// Enhanced Authentication API
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  User,
  CreateAPIKeyRequest,
  CreateAPIKeyResponse,
  APIKey,
  TokenInfo
} from '../types'
import { fetchApi, tokenManager } from './client'
import { config } from '../config/config'

// Create secure storage instance for auth-specific data
class AuthSecureStorage {
  private readonly keyPrefix = 'slime_ui_auth_'

  set(key: string, value: string): void {
    try {
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
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.keyPrefix))
      keys.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.error('Failed to clear auth data:', error)
    }
  }
}

const secureStorage = new AuthSecureStorage()

// ============================================================================
// LEGACY AUTH COMPATIBILITY LAYER
// ============================================================================

// Note: Legacy auth methods removed - using tokenManager directly

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

  // Login and store token info
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await fetchApi<LoginResponse>(config.api.endpoints.auth.login, {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true, // Login doesn't require existing auth
      timeout: 15000, // Shorter timeout for auth operations
    })

    // Store token info securely
    if (response.token_info) {
      tokenManager.setTokenInfo(response.token_info)
      auth.setUserData(response.user)
    }

    // Note: CSRF token is now handled separately (session-based)
    // It should be available via meta tag or /auth/csrf-token endpoint

    if (config.features.enableDebugLogging) {
      console.log('[Auth] Login successful, tokens stored securely')
    }

    return response
  },

  // Refresh token
  refreshToken: () => tokenManager.refreshTokenIfNeeded(),

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

  // CSRF token management (session-based)
  getCsrfToken: () => fetchApi<{ csrf_token: string }>('/auth/csrf-token', {
    timeout: 5000,
  }),
}

// ============================================================================
// SECURE AUTH UTILITIES
// ============================================================================


// ============================================================================
// SECURE AUTH UTILITIES
// ============================================================================

// Enhanced Auth utilities with comprehensive token management
export const auth = {
  /**
   * Store API key securely (legacy method - use login instead)
   * @deprecated Use authApi.login() for new implementations
   */
  setApiKey: (apiKey: string) => {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Invalid API key provided')
    }

    if (apiKey.length < 10) {
      throw new Error('API key appears to be invalid')
    }

    // Create basic token info for legacy compatibility
    const tokenInfo: TokenInfo = {
      token: apiKey,
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours default
    }

    tokenManager.setTokenInfo(tokenInfo)

    if (config.features.enableDebugLogging) {
      console.log('[Auth] Legacy API key stored securely')
    }
  },

  /**
   * Get API key from secure storage (with automatic refresh)
   */
  getApiKey: async (): Promise<string | null> => {
    await tokenManager.refreshTokenIfNeeded()
    return tokenManager.getApiKey()
  },

  /**
   * Get API key synchronously (for backward compatibility)
   */
  getApiKeySync: (): string | null => {
    return tokenManager.getApiKey()
  },

  /**
   * Remove API key and clear all auth data
   */
  removeApiKey: () => {
    tokenManager.clearTokens()

    if (config.features.enableDebugLogging) {
      console.log('[Auth] API key and auth data cleared')
    }
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: (): boolean => {
    return tokenManager.getApiKey() !== null
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
   * Comprehensive secure logout
   */
  logout: () => {
    // Clear all tokens and session data
    tokenManager.clearTokens()
    auth.setUserData({}) // Clear user data

    // Clear any cached data
    if (typeof window !== 'undefined') {
      // Clear service worker caches
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            if (name.includes('auth') || name.includes('api') || name.includes('session')) {
              caches.delete(name)
            }
          })
        }).catch(error => {
          console.warn('[Auth] Failed to clear caches:', error)
        })
      }

      // Clear browser history state (prevent back button auth leaks)
      if (window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname)
      }

      // Clear any URL fragments that might contain tokens
      if (window.location.hash && window.location.hash.includes('token')) {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
      }

      // Emit logout event for components to react
      window.dispatchEvent(new CustomEvent('authLogout'))

      // Clear any stored form data that might contain sensitive info
      try {
        sessionStorage.clear()
      } catch (error) {
        console.warn('[Auth] Failed to clear session storage:', error)
      }
    }

    if (config.features.enableDebugLogging) {
      console.log('[Auth] Comprehensive logout completed - all data cleared')
    }
  },

  /**
   * Validate current session with backend
   */
  validateSession: async (): Promise<boolean> => {
    try {
      if (!tokenManager.getApiKey()) {
        return false
      }

      // Try to refresh token if needed
      await tokenManager.refreshTokenIfNeeded()

      // Validate session with backend
      await authApi.getMe()
      return true
    } catch (error) {
      console.warn('[Auth] Session validation failed:', error)
      auth.logout()
      return false
    }
  },

  /**
   * Get session information (for debugging/monitoring)
   */
  getSessionInfo: () => {
    return tokenManager.getSessionInfo()
  },

  /**
   * Manually trigger token refresh (API tokens only)
   * CSRF tokens are session-based and don't need refresh
   */
  refreshToken: () => tokenManager.refreshTokenIfNeeded(),

  /**
   * Check if token needs refresh
   */
  shouldRefreshToken: (): boolean => {
    const tokenInfo = tokenManager.getTokenInfo()
    return tokenInfo ? (new Date(tokenInfo.expires_at || 0).getTime() - Date.now()) <= config.auth.tokenRefreshBuffer : false
  },

  /**
   * Get token expiration info
   */
  getTokenExpiration: (): { expires_at: string | null, needs_refresh: boolean } => {
    const tokenInfo = tokenManager.getTokenInfo()
    return {
      expires_at: tokenInfo?.expires_at || null,
      needs_refresh: auth.shouldRefreshToken()
    }
  },
}



