/**
 * Input Validation and Sanitization Utilities
 *
 * This module provides comprehensive validation and sanitization functions
 * for user inputs, form data, and API payloads. Designed to be easily
 * upgradeable to use libraries like zod for schema validation.
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ValidationResult<T = unknown> {
  isValid: boolean
  errors: string[]
  sanitizedValue?: T
}

export interface ValidationRule {
  validate: (value: unknown) => boolean
  message: string
  sanitize?: (value: unknown) => unknown
}

export interface ValidationSchema {
  [key: string]: ValidationRule[]
}

// ============================================================================
// SANITIZATION FUNCTIONS
// ============================================================================

/**
 * Sanitize string input by removing potentially dangerous characters
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return ''

  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters (except newlines and tabs)
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/gu, '')
    // Trim whitespace
    .trim()
}

/**
 * Sanitize HTML content to prevent XSS
 * Basic implementation - consider using DOMPurify for production
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') return ''

  return input
    // Remove script tags and their contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove javascript: URLs
    .replace(/javascript:[^"'\s]*/gi, '')
    // Remove vbscript: URLs
    .replace(/vbscript:[^"'\s]*/gi, '')
    // Remove data: URLs (can contain scripts)
    .replace(/data:\s*text\/html[^"'\s]*/gi, '')
    // Remove onclick and other event handlers
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    // Remove style attributes that could contain javascript
    .replace(/style\s*=\s*"[^"]*"/gi, '')
    .replace(/style\s*=\s*'[^']*'/gi, '')
    // Basic HTML entity encoding for < > &
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&(?!(?:amp|lt|gt|quot|apos|#x?[0-9a-f]+);)/gi, '&amp;')
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return ''

  return sanitizeString(email).toLowerCase()
}

/**
 * Sanitize username (allow alphanumeric, underscore, dash)
 */
export function sanitizeUsername(username: string): string {
  if (typeof username !== 'string') return ''

  return sanitizeString(username)
    // Remove any character that's not alphanumeric, underscore, or dash
    .replace(/[^a-zA-Z0-9_-]/g, '')
}

/**
 * Sanitize password (remove control characters, trim)
 */
export function sanitizePassword(password: string): string {
  if (typeof password !== 'string') return ''

  return password
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/gu, '')
    // Trim whitespace
    .trim()
}

/**
 * Sanitize general object properties
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj }

  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string') {
      // Apply field-specific sanitization
      if (key.toLowerCase().includes('email')) {
        sanitized[key] = sanitizeEmail(value)
      } else if (key.toLowerCase().includes('password')) {
        sanitized[key] = sanitizePassword(value)
      } else if (key.toLowerCase().includes('username')) {
        sanitized[key] = sanitizeUsername(value)
      } else {
        sanitized[key] = sanitizeString(value)
      }
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value)
    }
  }

  return sanitized
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254 // RFC 5321 limit
}

/**
 * Validate password strength
 */
export function isValidPassword(password: string): ValidationResult {
  const errors: string[] = []

  if (typeof password !== 'string') {
    return { isValid: false, errors: ['Password must be a string'] }
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }

  if (password.length > 128) {
    errors.push('Password must be less than 128 characters long')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  // Check for common weak passwords
  const commonPasswords = ['password', '12345678', 'qwerty', 'abc123', 'password123', 'password', '123456', '123456789', 'qwerty123', 'admin', 'letmein']
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('This password is too common. Please choose a stronger password')
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: sanitizePassword(password)
  }
}

/**
 * Validate username
 */
export function isValidUsername(username: string): ValidationResult {
  const errors: string[] = []

  if (typeof username !== 'string') {
    return { isValid: false, errors: ['Username must be a string'] }
  }

  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long')
  }

  if (username.length > 50) {
    errors.push('Username must be less than 50 characters long')
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, underscores, and dashes')
  }

  if (/^-|-$/.test(username)) {
    errors.push('Username cannot start or end with a dash')
  }

  // Check for reserved usernames
  const reservedUsernames = ['admin', 'root', 'system', 'api', 'user', 'guest']
  if (reservedUsernames.includes(username.toLowerCase())) {
    errors.push('This username is not available')
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: sanitizeUsername(username)
  }
}

/**
 * Validate organization name
 */
export function isValidOrgName(orgName: string): ValidationResult {
  const errors: string[] = []

  if (typeof orgName !== 'string') {
    return { isValid: false, errors: ['Organization name must be a string'] }
  }

  if (orgName.length < 2) {
    errors.push('Organization name must be at least 2 characters long')
  }

  if (orgName.length > 100) {
    errors.push('Organization name must be less than 100 characters long')
  }

  // Allow letters, numbers, spaces, and common punctuation
  if (!/^[a-zA-Z0-9\s\-'&.,]+$/.test(orgName)) {
    errors.push('Organization name contains invalid characters')
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: sanitizeString(orgName)
  }
}

/**
 * Validate API key name
 */
export function isValidApiKeyName(name: string): ValidationResult {
  const errors: string[] = []

  if (typeof name !== 'string') {
    return { isValid: false, errors: ['API key name must be a string'] }
  }

  if (name.length < 1) {
    errors.push('API key name cannot be empty')
  }

  if (name.length > 50) {
    errors.push('API key name must be less than 50 characters long')
  }

  // Allow alphanumeric, spaces, underscores, and dashes
  if (!/^[a-zA-Z0-9\s_\-]+$/.test(name)) {
    errors.push('API key name can only contain letters, numbers, spaces, underscores, and dashes')
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: sanitizeString(name)
  }
}

/**
 * Validate required field
 */
export function isRequired(value: any, fieldName: string): ValidationResult {
  const isValid = value !== null && value !== undefined && value !== ''

  return {
    isValid,
    errors: isValid ? [] : [`${fieldName} is required`],
    sanitizedValue: value
  }
}

/**
 * Validate string length
 */
export function validateLength(value: string, min: number, max: number, fieldName: string): ValidationResult {
  if (typeof value !== 'string') {
    return { isValid: false, errors: [`${fieldName} must be a string`] }
  }

  const errors: string[] = []

  if (value.length < min) {
    errors.push(`${fieldName} must be at least ${min} characters long`)
  }

  if (value.length > max) {
    errors.push(`${fieldName} must be less than ${max} characters long`)
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: sanitizeString(value)
  }
}

// ============================================================================
// SCHEMA VALIDATION
// ============================================================================

/**
 * Validate login form data
 */
export function validateLoginData(data: {
  username: string
  password: string
}): ValidationResult {
  const errors: string[] = []

  // Validate username
  if (!data.username || data.username.trim().length === 0) {
    errors.push('Username is required')
  } else {
    const usernameResult = validateLength(data.username, 1, 50, 'Username')
    if (!usernameResult.isValid) {
      errors.push(...usernameResult.errors)
    }
  }

  // Validate password
  if (!data.password || data.password.length === 0) {
    errors.push('Password is required')
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: {
      username: sanitizeUsername(data.username || ''),
      password: sanitizePassword(data.password || '')
    }
  }
}

/**
 * Validate registration form data
 */
export function validateRegistrationData(data: {
  username: string
  email: string
  password: string
  org_name: string
}): ValidationResult {
  const errors: string[] = []

  // Validate username
  const usernameResult = isValidUsername(data.username)
  if (!usernameResult.isValid) {
    errors.push(...usernameResult.errors)
  }

  // Validate email
  if (!isValidEmail(data.email)) {
    errors.push('Please enter a valid email address')
  }

  // Validate password
  const passwordResult = isValidPassword(data.password)
  if (!passwordResult.isValid) {
    errors.push(...passwordResult.errors)
  }

  // Validate organization name
  const orgResult = isValidOrgName(data.org_name)
  if (!orgResult.isValid) {
    errors.push(...orgResult.errors)
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: {
      username: usernameResult.sanitizedValue,
      email: sanitizeEmail(data.email),
      password: passwordResult.sanitizedValue,
      org_name: orgResult.sanitizedValue
    }
  }
}

/**
 * Validate API key creation data
 */
export function validateApiKeyData(data: {
  name: string
  expires_at?: string
}): ValidationResult {
  const errors: string[] = []

  // Validate name
  const nameResult = isValidApiKeyName(data.name)
  if (!nameResult.isValid) {
    errors.push(...nameResult.errors)
  }

  // Validate expiration date if provided
  if (data.expires_at) {
    const expiryDate = new Date(data.expires_at)
    const now = new Date()

    if (isNaN(expiryDate.getTime())) {
      errors.push('Invalid expiration date format')
    } else if (expiryDate <= now) {
      errors.push('Expiration date must be in the future')
    } else if (expiryDate > new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)) {
      errors.push('Expiration date cannot be more than 1 year in the future')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: {
      name: nameResult.sanitizedValue,
      expires_at: data.expires_at
    }
  }
}

/**
 * Validate user input for XSS protection
 */
export function validateAndSanitizeUserInput(input: string, fieldName: string = 'input'): ValidationResult {
  if (typeof input !== 'string') {
    return { isValid: false, errors: [`${fieldName} must be a string`] }
  }

  const sanitized = sanitizeHtml(input)

  // Check if the input contained dangerous content
  const hasScriptTag = /<script/i.test(input)
  const hasJavaScriptUrl = /javascript:/i.test(input)
  const hasEventHandler = /on\w+\s*=/i.test(input)

  if (hasScriptTag || hasJavaScriptUrl || hasEventHandler) {
    return {
      isValid: false,
      errors: [`${fieldName} contains potentially unsafe content`],
      sanitizedValue: sanitized
    }
  }

  return {
    isValid: true,
    errors: [],
    sanitizedValue: sanitized
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get user-friendly error message that doesn't expose sensitive information
 */
export function getSafeErrorMessage(error: any): string {
  // Never expose internal errors, stack traces, or sensitive data
  if (typeof error === 'string') {
    // Check for common error patterns that might leak info
    if (error.includes('SQL') || error.includes('database') || error.includes('connection')) {
      return 'A system error occurred. Please try again later.'
    }
    return error
  }

  if (error && typeof error === 'object') {
    // Check for validation errors
    if (error.errors && Array.isArray(error.errors)) {
      return error.errors.join(', ')
    }

    // Check for message property
    if (error.message && typeof error.message === 'string') {
      return getSafeErrorMessage(error.message)
    }
  }

  return 'An unexpected error occurred. Please try again.'
}

/**
 * Validate form data against a schema
 */
export function validateAgainstSchema(data: Record<string, any>, schema: ValidationSchema): ValidationResult {
  const errors: string[] = []
  const sanitizedData: Record<string, any> = {}

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field]

    for (const rule of rules) {
      if (!rule.validate(value)) {
        errors.push(rule.message)
        break // Stop at first validation failure for this field
      }

      // Apply sanitization if provided
      if (rule.sanitize) {
        sanitizedData[field] = rule.sanitize(value)
      } else {
        sanitizedData[field] = value
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: sanitizedData
  }
}

// ============================================================================
// EXPORTS - All functions are exported above with their definitions
// ============================================================================
