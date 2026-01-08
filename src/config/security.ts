/**
 * Security Configuration
 *
 * This module provides security-related configuration and utilities,
 * including Content Security Policy settings and validation.
 */

import { config } from './config';

/**
 * Content Security Policy configuration for different environments
 */
export const cspConfig = {
  production: {
    directives: {
      'default-src': "'self'",
      'script-src': "'self' 'nonce-{NONCE}' https://fonts.googleapis.com",
      'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
      'font-src': "'self' https://fonts.gstatic.com",
      'img-src': "'self' data: https:",
      'connect-src': "'self' " + config.api.baseUrl,
      'object-src': "'none'",
      'base-uri': "'self'",
      'form-action': "'self'",
      'frame-ancestors': "'none'",
      'upgrade-insecure-requests': '',
    },
  },

  development: {
    directives: {
      'default-src': "'self'",
      'script-src':
        "'self' 'unsafe-eval' 'unsafe-inline' http://localhost:* https://fonts.googleapis.com",
      'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
      'font-src': "'self' https://fonts.gstatic.com",
      'img-src': "'self' data: https:",
      'connect-src': "'self' http://localhost:* https://fonts.googleapis.com",
      'object-src': "'none'",
      'base-uri': "'self'",
      'form-action': "'self'",
    },
  },
};

/**
 * Generate CSP header string from directives
 */
export function generateCSPHeader(directives: Record<string, string>, nonce?: string): string {
  const cspParts: string[] = [];

  for (const [directive, value] of Object.entries(directives)) {
    if (value) {
      let processedValue = value;
      if (nonce && value.includes('{NONCE}')) {
        processedValue = value.replace('{NONCE}', `'nonce-${nonce}'`);
      }
      cspParts.push(`${directive} ${processedValue}`);
    } else {
      // For directives without values (like upgrade-insecure-requests)
      cspParts.push(directive);
    }
  }

  return cspParts.join('; ');
}

/**
 * Get CSP configuration for current environment
 */
export function getCSPConfig() {
  return config.app.isProduction ? cspConfig.production : cspConfig.development;
}

/**
 * Validate CSP configuration
 */
export function validateCSPConfig(): boolean {
  const currentConfig = getCSPConfig();

  // Ensure required directives are present
  const requiredDirectives = ['default-src', 'script-src', 'style-src', 'connect-src'];

  for (const directive of requiredDirectives) {
    if (!currentConfig.directives[directive]) {
      console.warn(`Missing required CSP directive: ${directive}`);
      return false;
    }
  }

  // Ensure API base URL is included in connect-src for production
  if (config.app.isProduction) {
    const connectSrc = currentConfig.directives['connect-src'];
    if (!connectSrc.includes(config.api.baseUrl)) {
      console.warn(`API base URL ${config.api.baseUrl} not included in connect-src directive`);
      return false;
    }
  }

  return true;
}

/**
 * Security headers for HTTP responses (for server-side deployment)
 */
export const securityHeaders = {
  // Content Security Policy
  'Content-Security-Policy': generateCSPHeader(getCSPConfig().directives),

  // Other security headers
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',

  // HTTPS Strict Transport Security (only for HTTPS)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Cache control for security
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

/**
 * Generate a random nonce for CSP
 */
export function generateNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.randomBytes) {
    return crypto.randomBytes(16).toString('base64');
  }

  // Fallback for environments without crypto
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Initialize security configuration
 * Call this function early in the application lifecycle
 */
export function initializeSecurity(): void {
  if (!validateCSPConfig()) {
    console.error('CSP configuration validation failed');
    if (config.app.isProduction) {
      throw new Error('Invalid CSP configuration in production');
    }
  }

  console.log('✓ Security configuration initialized');
}
