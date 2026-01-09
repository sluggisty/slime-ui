import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  sanitizeHtml,
  sanitizeEmail,
  sanitizeUsername,
  sanitizePassword,
  sanitizeObject,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  isValidOrgName,
  isValidApiKeyName,
  isRequired,
  validateLength,
  validateLoginData,
  validateRegistrationData,
  validateApiKeyData,
  validateAndSanitizeUserInput,
  getSafeErrorMessage,
  validateAgainstSchema,
} from './validation';

describe('Validation Utilities', () => {
  describe('Sanitization', () => {
    describe('sanitizeString', () => {
      it('removes null bytes', () => {
        expect(sanitizeString('test\x00string')).toBe('teststring');
      });

      it('removes control characters', () => {
        expect(sanitizeString('test\x01string')).toBe('teststring');
      });

      it('trims whitespace', () => {
        expect(sanitizeString('  test  ')).toBe('test');
      });

      it('handles null/undefined input', () => {
        expect(sanitizeString(null as any)).toBe('');
        expect(sanitizeString(undefined as any)).toBe('');
      });
    });

    describe('sanitizeHtml', () => {
      it('removes script tags', () => {
        expect(sanitizeHtml('<script>alert("xss")</script>')).toBe('');
      });

      it('removes javascript URLs', () => {
        expect(sanitizeHtml('<a href="javascript:alert()">link</a>')).toBe(
          '&lt;a href=""&gt;link&lt;/a&gt;'
        );
      });

      it('removes event handlers', () => {
        expect(sanitizeHtml('<div onclick="alert()">test</div>')).toBe(
          '&lt;div &gt;test&lt;/div&gt;'
        );
      });

      it('encodes dangerous characters', () => {
        expect(sanitizeHtml('<test>')).toBe('&lt;test&gt;');
        expect(sanitizeHtml('"test"')).toBe('"test"');
      });
    });

    describe('sanitizeEmail', () => {
      it('converts to lowercase', () => {
        expect(sanitizeEmail('Test@Example.COM')).toBe('test@example.com');
      });

      it('handles invalid input', () => {
        expect(sanitizeEmail(null as any)).toBe('');
      });
    });

    describe('sanitizeUsername', () => {
      it('removes invalid characters', () => {
        expect(sanitizeUsername('user@name!')).toBe('username');
      });

      it('preserves valid characters', () => {
        expect(sanitizeUsername('user_name-123')).toBe('user_name-123');
      });
    });

    describe('sanitizePassword', () => {
      it('removes control characters', () => {
        expect(sanitizePassword('pass\x00word')).toBe('password');
      });

      it('trims whitespace', () => {
        expect(sanitizePassword('  password  ')).toBe('password');
      });
    });

    describe('sanitizeObject', () => {
      it('sanitizes all string properties', () => {
        const obj = {
          name: '  test  ',
          email: 'Test@EXAMPLE.COM',
          nested: {
            value: '  nested  ',
          },
        };

        const result = sanitizeObject(obj);
        expect(result.name).toBe('test');
        expect(result.email).toBe('test@example.com');
        expect(result.nested.value).toBe('nested');
      });
    });
  });

  describe('Validation', () => {
    describe('isValidEmail', () => {
      it('validates correct email formats', () => {
        expect(isValidEmail('test@example.com')).toBe(true);
        expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true);
      });

      it('rejects invalid email formats', () => {
        expect(isValidEmail('invalid')).toBe(false);
        expect(isValidEmail('@example.com')).toBe(false);
        expect(isValidEmail('test@')).toBe(false);
      });

      it('rejects overly long emails', () => {
        const longEmail = 'a'.repeat(250) + '@example.com';
        expect(isValidEmail(longEmail)).toBe(false);
      });
    });

    describe('isValidPassword', () => {
      it('validates strong passwords', () => {
        const result = isValidPassword('StrongP@ss123');
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('rejects weak passwords', () => {
        expect(isValidPassword('short')).not.toBeValid();
        expect(isValidPassword('password123')).not.toBeValid();
        expect(isValidPassword('Password')).not.toBeValid();
        expect(isValidPassword('password')).not.toBeValid();
      });

      it('rejects common passwords', () => {
        const result = isValidPassword('password');
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('too common'))).toBe(true);
      });
    });

    describe('isValidUsername', () => {
      it('validates correct usernames', () => {
        expect(isValidUsername('testuser')).toBeValid();
        expect(isValidUsername('user_123')).toBeValid();
        expect(isValidUsername('user-name')).toBeValid();
      });

      it('rejects invalid usernames', () => {
        expect(isValidUsername('us')).not.toBeValid(); // too short
        expect(isValidUsername('user@name')).not.toBeValid(); // invalid chars
        expect(isValidUsername('-user')).not.toBeValid(); // starts with dash
        expect(isValidUsername('admin')).not.toBeValid(); // reserved
      });
    });

    describe('isValidOrgName', () => {
      it('validates correct organization names', () => {
        expect(isValidOrgName('Test Company')).toBeValid();
        expect(isValidOrgName('Company & Co.')).toBeValid();
        expect(isValidOrgName('Test-Corp')).toBeValid();
      });

      it('rejects invalid organization names', () => {
        expect(isValidOrgName('')).not.toBeValid();
        expect(isValidOrgName('a'.repeat(101))).not.toBeValid(); // too long
        expect(isValidOrgName('Company@Corp')).not.toBeValid(); // invalid chars
      });
    });

    describe('validateLength', () => {
      it('validates string length', () => {
        expect(validateLength('test', 2, 10, 'Field')).toBeValid();
        expect(validateLength('t', 2, 10, 'Field')).not.toBeValid();
        expect(validateLength('a'.repeat(15), 2, 10, 'Field')).not.toBeValid();
      });
    });
  });

  describe('Schema Validation', () => {
    describe('validateLoginData', () => {
      it('validates correct login data', () => {
        const result = validateLoginData({
          username: 'testuser',
          password: 'password123',
        });
        expect(result.isValid).toBe(true);
        expect(result.sanitizedValue.username).toBe('testuser');
      });

      it('rejects invalid login data', () => {
        const result = validateLoginData({
          username: '',
          password: '',
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Username is required');
        expect(result.errors).toContain('Password is required');
      });
    });

    describe('validateRegistrationData', () => {
      it('validates correct registration data', () => {
        const result = validateRegistrationData({
          username: 'testuser',
          email: 'test@example.com',
          password: 'StrongP@ss123',
          org_name: 'Test Company',
        });
        expect(result.isValid).toBe(true);
        expect(result.sanitizedValue.email).toBe('test@example.com');
      });

      it('rejects invalid registration data', () => {
        const result = validateRegistrationData({
          username: 'us', // too short
          email: 'invalid', // invalid email
          password: 'weak', // weak password
          org_name: '', // empty
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('validateApiKeyData', () => {
      it('validates correct API key data', () => {
        const result = validateApiKeyData({
          name: 'My API Key',
        });
        expect(result.isValid).toBe(true);
        expect(result.sanitizedValue.name).toBe('My API Key');
      });

      it('validates expiration dates', () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString(); // tomorrow
        const result = validateApiKeyData({
          name: 'Test Key',
          expires_at: futureDate,
        });
        expect(result.isValid).toBe(true);
      });

      it('rejects past expiration dates', () => {
        const pastDate = new Date(Date.now() - 86400000).toISOString(); // yesterday
        const result = validateApiKeyData({
          name: 'Test Key',
          expires_at: pastDate,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Expiration date must be in the future');
      });
    });

    describe('validateAndSanitizeUserInput', () => {
      it('allows safe HTML', () => {
        const result = validateAndSanitizeUserInput('<p>Safe content</p>');
        expect(result.isValid).toBe(true);
      });

      it('sanitizes dangerous HTML', () => {
        const result = validateAndSanitizeUserInput('<script>alert("xss")</script>');
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('unsafe content'))).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    describe('getSafeErrorMessage', () => {
      it('returns user-friendly error messages', () => {
        expect(getSafeErrorMessage('SQL error')).toBe(
          'A system error occurred. Please try again later.'
        );
        expect(getSafeErrorMessage('Custom error message')).toBe('Custom error message');
        expect(getSafeErrorMessage({ errors: ['Field is required'] })).toBe('Field is required');
      });

      it('handles various error formats', () => {
        expect(getSafeErrorMessage(null)).toBe('An unexpected error occurred. Please try again.');
        expect(getSafeErrorMessage({})).toBe('An unexpected error occurred. Please try again.');
      });
    });
  });

  describe('Schema Validation', () => {
    describe('validateAgainstSchema', () => {
      const schema = {
        username: [
          {
            validate: (v: any) => typeof v === 'string' && v.length >= 3,
            message: 'Username too short',
          },
          {
            validate: (v: any) => typeof v === 'string' && v.length <= 20,
            message: 'Username too long',
          },
        ],
        email: [
          {
            validate: (v: any) => typeof v === 'string' && v.includes('@'),
            message: 'Invalid email',
          },
        ],
      };

      it('validates data against schema', () => {
        const result = validateAgainstSchema(
          { username: 'testuser', email: 'test@example.com' },
          schema
        );
        expect(result.isValid).toBe(true);
      });

      it('returns validation errors', () => {
        const result = validateAgainstSchema({ username: 'ab', email: 'invalid' }, schema);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Username too short');
        expect(result.errors).toContain('Invalid email');
      });
    });
  });
});

// Custom matchers for tests
declare module 'vitest' {
  interface Assertion {
    toBeValid(): void;
  }
}

// Add custom matcher
expect.extend({
  toBeValid(received) {
    const pass = received && typeof received === 'object' && received.isValid === true;
    return {
      message: () => `expected ${received} to be valid`,
      pass,
    };
  },
});
