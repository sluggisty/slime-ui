import { chromium, FullConfig } from '@playwright/test'
import { loginUser } from './test-helpers'

/**
 * Global setup runs once before all tests.
 * Use this to set up test data, authenticate users, or perform one-time initialization.
 */
async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000'
  
  // Create a browser context for setup
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Navigate to the base URL to ensure the app is accessible
    await page.goto(baseURL)
    
    // Optional: Perform login and save authenticated state for reuse across tests
    // Uncomment the following lines if you want to use authenticated state in tests
    // 
    // await loginUser(page, 'testuser', 'testpass')
    // await context.storageState({ path: 'e2e/.auth/user.json' })
    
    // Optional: Set up test data or perform other one-time setup tasks here
    // For example:
    // - Create test users in the database
    // - Set up test organizations
    // - Initialize test hosts or other test data
    
  } catch (error) {
    console.error('Global setup failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

export default globalSetup

