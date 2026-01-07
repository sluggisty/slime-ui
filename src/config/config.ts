/**
 * Centralized Application Configuration
 *
 * This module provides a unified configuration system for the application.
 * It combines environment variables, API settings, query configurations,
 * feature flags, and other application-wide settings.
 */

import { config as envConfig } from './env'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ApiConfig {
  baseUrl: string
  basePath: string
  timeout: number
  retry: {
    maxAttempts: number
    backoffMultiplier: number
    initialDelay: number
  }
  endpoints: {
    health: string
    hosts: string
    hostById: (id: string) => string
    auth: {
      login: string
      register: string
      me: string
      refresh: string
    }
    users: string
    apiKeys: string
  }
}

export interface QueryConfig {
  defaultOptions: {
    queries: {
      staleTime: number
      gcTime: number
      retry: boolean | number
      retryDelay: number
      refetchOnWindowFocus: boolean
      refetchOnMount: boolean
    }
    mutations: {
      retry: boolean | number
      retryDelay: number
    }
  }
  // Specific query configurations for different pages/features
  hosts: {
    staleTime: number
    refetchInterval?: number
  }
  hostDetail: {
    staleTime: number
  }
  userAccess: {
    staleTime: number
  }
  auth: {
    staleTime: number
    retry: boolean
  }
}

export interface AuthConfig {
  sessionTimeout: number // Session timeout in milliseconds
  tokenRefreshBuffer: number // Refresh token this many ms before expiry
  activityCheckInterval: number // Check user activity interval
  maxSessionAge: number // Maximum session age
  enableAutoRefresh: boolean // Enable automatic token refresh
  enableSessionMonitoring: boolean // Enable session activity monitoring
}

export interface FeatureFlags {
  enableRealTimeUpdates: boolean
  enableDebugLogging: boolean
  enableErrorReporting: boolean
  enableAnalytics: boolean
  enablePWA: boolean
}

export interface AppConfig {
  name: string
  version: string
  environment: 'development' | 'production' | 'test'
  isDevelopment: boolean
  isProduction: boolean
  isTest: boolean
}

export interface UiConfig {
  theme: {
    primaryColor: string
    secondaryColor: string
    dangerColor: string
    successColor: string
  }
  pagination: {
    defaultPageSize: number
    maxPageSize: number
  }
  animations: {
    enabled: boolean
    duration: number
  }
}

export interface Config {
  app: AppConfig
  api: ApiConfig
  auth: AuthConfig
  query: QueryConfig
  features: FeatureFlags
  ui: UiConfig
}

// ============================================================================
// CONFIGURATION FUNCTIONS
// ============================================================================

/**
 * Get API configuration based on current environment
 */
function getApiConfig(): ApiConfig {
  return {
    baseUrl: envConfig.apiBaseUrl,
    basePath: '/api/v1',
    timeout: 30000, // 30 seconds
    retry: {
      maxAttempts: envConfig.isDevelopment ? 1 : 3,
      backoffMultiplier: 2,
      initialDelay: 1000, // 1 second
    },
    endpoints: {
      health: '/health',
      hosts: '/hosts',
      hostById: (id: string) => `/hosts/${id}`,
      auth: {
        login: '/auth/login',
        register: '/auth/register',
        me: '/auth/me',
        refresh: '/auth/refresh',
      },
      users: '/users',
      apiKeys: '/api-keys',
    },
  }
}

/**
 * Get authentication configuration
 */
function getAuthConfig(): AuthConfig {
  return {
    sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
    tokenRefreshBuffer: 5 * 60 * 1000, // 5 minutes before expiry
    activityCheckInterval: 60 * 1000, // 1 minute
    maxSessionAge: 24 * 60 * 60 * 1000, // 24 hours
    enableAutoRefresh: true,
    enableSessionMonitoring: true,
  }
}

/**
 * Get React Query configuration
 */
function getQueryConfig(): QueryConfig {
  const baseRetry = envConfig.isDevelopment ? false : 3
  const baseRetryDelay = 1000 // 1 second

  return {
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
        retry: baseRetry,
        retryDelay: baseRetryDelay,
        refetchOnWindowFocus: !envConfig.isDevelopment,
        refetchOnMount: true,
      },
      mutations: {
        retry: baseRetry,
        retryDelay: baseRetryDelay,
      },
    },
    // Page-specific configurations
    hosts: {
      staleTime: 2 * 60 * 1000, // 2 minutes
      refetchInterval: envConfig.isDevelopment ? undefined : 5 * 60 * 1000, // 5 minutes in production
    },
    hostDetail: {
      staleTime: 10 * 60 * 1000, // 10 minutes
    },
    userAccess: {
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    auth: {
      staleTime: 15 * 60 * 1000, // 15 minutes
      retry: false, // Auth queries should not retry automatically
    },
  }
}

/**
 * Get feature flags based on environment
 */
function getFeatureFlags(): FeatureFlags {
  return {
    enableRealTimeUpdates: true,
    enableDebugLogging: envConfig.isDevelopment,
    enableErrorReporting: envConfig.isProduction,
    enableAnalytics: envConfig.isProduction,
    enablePWA: true,
  }
}

/**
 * Get UI configuration
 */
function getUiConfig(): UiConfig {
  return {
    theme: {
      primaryColor: '#00ff88', // slime-green
      secondaryColor: '#1a1a1a',
      dangerColor: '#ff4757',
      successColor: '#2ed573',
    },
    pagination: {
      defaultPageSize: 25,
      maxPageSize: 100,
    },
    animations: {
      enabled: true,
      duration: 200, // milliseconds
    },
  }
}

/**
 * Get application configuration
 */
function getAppConfig(): AppConfig {
  const environment = import.meta.env.MODE as 'development' | 'production' | 'test'

  return {
    name: envConfig.appName,
    version: envConfig.appVersion,
    environment,
    isDevelopment: envConfig.isDevelopment,
    isProduction: envConfig.isProduction,
    isTest: environment === 'test',
  }
}

// ============================================================================
// MAIN CONFIGURATION EXPORT
// ============================================================================

/**
 * Get the complete application configuration
 *
 * This function validates all configuration at runtime and throws errors
 * for invalid or missing required values.
 *
 * @throws {Error} If configuration validation fails
 */
export function getConfig(): Config {
  try {
    // Validate environment configuration
    if (!envConfig.apiBaseUrl) {
      throw new Error('API base URL is required')
    }

    if (!envConfig.appName) {
      throw new Error('Application name is required')
    }

    const config: Config = {
      app: getAppConfig(),
      api: getApiConfig(),
      auth: getAuthConfig(),
      query: getQueryConfig(),
      features: getFeatureFlags(),
      ui: getUiConfig(),
    }

    // Additional validation can be added here
    validateConfig(config)

    return config
  } catch (error) {
    console.error('Configuration validation failed:', error)
    throw error
  }
}

/**
 * Validate configuration object
 */
function validateConfig(config: Config): void {
  // Validate API URLs
  try {
    new URL(config.api.baseUrl)
  } catch {
    throw new Error(`Invalid API base URL: ${config.api.baseUrl}`)
  }

  // Validate timeouts
  if (config.api.timeout <= 0) {
    throw new Error('API timeout must be greater than 0')
  }

  // Validate retry configuration
  if (config.api.retry.maxAttempts < 0) {
    throw new Error('Max retry attempts must be non-negative')
  }

  // Validate query configuration
  if (config.query.defaultOptions.queries.staleTime < 0) {
    throw new Error('Query stale time must be non-negative')
  }

  if (config.query.defaultOptions.queries.gcTime < 0) {
    throw new Error('Query gc time must be non-negative')
  }
}

// ============================================================================
// CONFIGURATION INSTANCE
// ============================================================================

/**
 * The application configuration instance
 * This is computed once at module load time
 */
/**
 * The application configuration instance
 * This is computed once at module load time
 */
export const config = getConfig()

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get full API endpoint URL
 */
export function getApiEndpoint(endpoint: string): string {
  return `${config.api.basePath}${endpoint}`
}

/**
 * Get full API URL for requests
 */
export function getApiUrl(endpoint: string): string {
  const fullEndpoint = getApiEndpoint(endpoint)

  // In test environment with TEST_API_CLIENT, convert relative URLs to absolute
  if (config.app.isTest && fullEndpoint.startsWith('/')) {
    return `${config.api.baseUrl}${fullEndpoint}`
  }

  return fullEndpoint
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return config.features[feature]
}

/**
 * Get query options for a specific feature
 */
export function getQueryOptions(feature?: keyof QueryConfig): QueryConfig['defaultOptions']['queries'] {
  if (feature && feature in config.query) {
    const featureConfig = config.query[feature] as Partial<QueryConfig['defaultOptions']['queries']>
    return {
      ...config.query.defaultOptions.queries,
      ...featureConfig,
    }
  }

  return config.query.defaultOptions.queries
}

/**
 * Get mutation options
 */
export function getMutationOptions(): QueryConfig['defaultOptions']['mutations'] {
  return config.query.defaultOptions.mutations
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

