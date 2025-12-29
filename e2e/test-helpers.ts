import { Page, expect } from '@playwright/test'

/**
 * Authenticate a user by logging in
 */
export async function loginUser(
  page: Page,
  username: string = 'testuser',
  password: string = 'testpass'
) {
  await page.goto('/login')
  await page.fill('#username', username)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  // Wait for navigation to dashboard after login
  await page.waitForURL('/')
}

/**
 * Register a new user
 */
export async function registerUser(
  page: Page,
  username: string,
  password: string,
  email: string,
  orgName: string
) {
  await page.goto('/register')
  await page.fill('#username', username)
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.fill('#confirmPassword', password)
  await page.fill('#orgName', orgName)
  await page.click('button[type="submit"]')
  // Wait for navigation after registration (either dashboard or login)
  await page.waitForURL(/^\/(login)?$/)
}

/**
 * Wait for API calls to complete (useful for pages using TanStack Query)
 */
export async function waitForApiCalls(page: Page) {
  await page.waitForLoadState('networkidle')
}

/**
 * Get API key from localStorage (for testing authenticated routes)
 * Note: The API key is stored with key 'api_key' in localStorage
 */
export async function getApiKey(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    return localStorage.getItem('api_key')
  })
}

/**
 * Set API key in localStorage (for testing authenticated routes without login)
 */
export async function setApiKey(page: Page, apiKey: string) {
  await page.evaluate((key) => {
    localStorage.setItem('api_key', key)
  }, apiKey)
}

/**
 * Clear authentication state (remove API key from localStorage)
 */
export async function clearAuth(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('api_key')
  })
}

/**
 * Navigate to a specific route and wait for it to load
 */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState('domcontentloaded')
}

/**
 * Wait for a specific element to be visible
 */
export async function waitForElement(page: Page, selector: string) {
  await page.waitForSelector(selector, { state: 'visible' })
}

/**
 * Fill a form field by label text
 */
export async function fillByLabel(page: Page, labelText: string, value: string) {
  const label = page.getByLabel(labelText)
  await label.fill(value)
}

/**
 * Click a button by text
 */
export async function clickButtonByText(page: Page, text: string) {
  await page.getByRole('button', { name: text }).click()
}

/**
 * Check if user is authenticated (has API key in localStorage)
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const apiKey = await getApiKey(page)
  return apiKey !== null && apiKey.length > 0
}

/**
 * Wait for a specific text to appear on the page
 */
export async function waitForText(page: Page, text: string) {
  await page.getByText(text).first().waitFor({ state: 'visible' })
}

/**
 * Get text content of an element by selector
 */
export async function getTextContent(page: Page, selector: string): Promise<string | null> {
  const element = await page.locator(selector).first()
  return await element.textContent()
}

/**
 * Check if element exists on the page
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  const count = await page.locator(selector).count()
  return count > 0
}

/**
 * Wait for page to be fully loaded (including all async operations)
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle')
}

/**
 * Create test user data
 */
export function createTestUser(overrides?: {
  username?: string
  password?: string
  email?: string
  orgName?: string
}) {
  const timestamp = Date.now()
  return {
    username: overrides?.username || `testuser_${timestamp}`,
    password: overrides?.password || 'testpass123',
    email: overrides?.email || `test_${timestamp}@example.com`,
    orgName: overrides?.orgName || `Test Org ${timestamp}`,
  }
}

