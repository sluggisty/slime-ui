/**
 * Environment configuration
 *
 * This module provides typed access to environment variables with validation and defaults.
 * All Vite environment variables must be prefixed with VITE_ to be exposed to the client.
 */

interface EnvConfig {
  apiBaseUrl: string;
  appName: string;
  appVersion: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

/**
 * Validates and returns the API base URL from environment
 */
function getApiBaseUrlFromEnv(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    // Remove trailing slash if present
    return envUrl.replace(/\/$/, '');
  }
  // Default to localhost for development
  return 'http://localhost:8080';
}

/**
 * Validates and returns the application name from environment
 */
function getAppNameFromEnv(): string {
  return import.meta.env.VITE_APP_NAME || 'Slime UI';
}

/**
 * Validates and returns the application version from environment
 */
function getAppVersionFromEnv(): string {
  return import.meta.env.VITE_APP_VERSION || '0.1.0';
}

/**
 * Get the current environment configuration
 *
 * @throws {Error} If required environment variables are invalid
 */
function getConfig(): EnvConfig {
  const apiBaseUrl = getApiBaseUrlFromEnv();

  // Validate API base URL format
  try {
    new URL(apiBaseUrl);
  } catch {
    if (import.meta.env.DEV) {
      console.warn(
        `Invalid VITE_API_BASE_URL format: "${apiBaseUrl}". ` +
          `Using default: http://localhost:8080`
      );
      // In development, fall back to default
      return getDefaultConfig();
    }
    throw new Error(
      `Invalid VITE_API_BASE_URL format: "${apiBaseUrl}". ` +
        `Must be a valid URL (e.g., http://localhost:8080 or https://api.example.com)`
    );
  }

  return {
    apiBaseUrl,
    appName: getAppNameFromEnv(),
    appVersion: getAppVersionFromEnv(),
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
  };
}

/**
 * Get default configuration (used as fallback)
 */
function getDefaultConfig(): EnvConfig {
  return {
    apiBaseUrl: 'http://localhost:8080',
    appName: 'Slime UI',
    appVersion: '0.1.0',
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
  };
}

// Export the configuration object
// In development, validate on module load
// In production, this will be evaluated at build time
export const config = getConfig();

// Export individual getters for convenience (using different names to avoid conflicts)
export const apiBaseUrl = () => config.apiBaseUrl;
export const appName = () => config.appName;
export const appVersion = () => config.appVersion;
export const isDev = () => config.isDevelopment;
export const isProd = () => config.isProduction;

// Export the config object as default
export default config;
