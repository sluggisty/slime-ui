import { test as base, BrowserContext, Page } from '@playwright/test'
import { loginUser } from './test-helpers'
import * as fs from 'fs'
import * as path from 'path'

// Path to authentication state file (relative to e2e directory)
const authFile = path.join(process.cwd(), 'e2e', '.auth', 'user.json')

/**
 * Type definitions for custom fixtures
 */
type AuthenticatedFixtures = {
  authenticatedPage: Page
  authenticatedContext: BrowserContext
}

/**
 * Extended test with custom fixtures
 */
export const test = base.extend<AuthenticatedFixtures>({
  /**
   * authenticatedPage fixture: Automatically logs in before each test
   * This creates a page and logs in the user, eliminating the need for
   * loginUser() calls in beforeEach hooks.
   * 
   * Usage:
   * test('my test', async ({ authenticatedPage }) => {
   *   await authenticatedPage.goto('/dashboard')
   *   // User is already logged in
   * })
   */
  authenticatedPage: async ({ page }, use) => {
    // Login the user before using the page
    await loginUser(page, 'testuser', 'testpass')
    
    // Use the authenticated page in the test
    await use(page)
    
    // Cleanup happens automatically after the test
  },

  /**
   * authenticatedContext fixture: Creates a browser context with saved authentication state
   * This is more efficient than authenticatedPage when you need multiple pages or want
   * to reuse authentication state across tests without logging in each time.
   * 
   * On first use, it will log in and save the authentication state to .auth/user.json.
   * Subsequent uses will reuse the saved state.
   * 
   * Usage:
   * test('my test', async ({ authenticatedContext }) => {
   *   const page = await authenticatedContext.newPage()
   *   await page.goto('/dashboard')
   *   // User is already authenticated
   * })
   */
  authenticatedContext: async ({ browser }, use) => {
    // Ensure .auth directory exists
    const authDir = path.dirname(authFile)
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true })
    }

    // Check if authentication state exists, if not create it
    if (!fs.existsSync(authFile)) {
      // Create a new context and log in
      const context = await browser.newContext()
      const page = await context.newPage()
      
      try {
        await loginUser(page, 'testuser', 'testpass')
        // Save authentication state for future use
        await context.storageState({ path: authFile })
      } finally {
        await context.close()
      }
    }

    // Create a new context using the saved authentication state
    const context = await browser.newContext({
      storageState: authFile,
    })

    // Use the authenticated context in the test
    await use(context)

    // Cleanup: close the context after the test
    await context.close()
  },
})

// Re-export expect for convenience
export { expect } from '@playwright/test'

