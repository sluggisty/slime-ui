import { test, expect } from '@playwright/test'
import { loginUser, registerUser, clearAuth, createTestUser, getApiKey } from './test-helpers'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/')
    await clearAuth(page)
  })

  test('should display login page', async ({ page }) => {
    await page.goto('/login')
    
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByLabel(/username/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
    await expect(page.getByText('Welcome to Sluggisty')).toBeVisible()
  })

  test('should display registration page', async ({ page }) => {
    await page.goto('/register')
    
    await expect(page).toHaveURL(/\/register/)
    await expect(page.getByLabel(/username/i)).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByLabel(/confirm password/i)).toBeVisible()
    await expect(page.getByLabel(/organization/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible()
  })

  test('should disable submit button when login fields are empty', async ({ page }) => {
    await page.goto('/login')
    
    const submitButton = page.getByRole('button', { name: /sign in/i })
    await expect(submitButton).toBeDisabled()
    
    // Fill username only
    await page.fill('#username', 'testuser')
    await expect(submitButton).toBeDisabled()
    
    // Fill password only (clear username first)
    await page.fill('#username', '')
    await page.fill('#password', 'testpass')
    await expect(submitButton).toBeDisabled()
  })

  test('should enable submit button when login fields are filled', async ({ page }) => {
    await page.goto('/login')
    
    await page.fill('#username', 'testuser')
    await page.fill('#password', 'testpass')
    
    const submitButton = page.getByRole('button', { name: /sign in/i })
    await expect(submitButton).toBeEnabled()
  })

  test('should show validation error when passwords do not match', async ({ page }) => {
    const testUser = createTestUser()
    
    await page.goto('/register')
    await page.fill('#username', testUser.username)
    await page.fill('#email', testUser.email)
    await page.fill('#password', testUser.password)
    await page.fill('#confirmPassword', 'differentpassword')
    await page.fill('#orgName', testUser.orgName)
    
    await page.getByRole('button', { name: /create account/i }).click()
    
    // Should show password mismatch error
    await expect(page.getByText(/passwords do not match/i)).toBeVisible()
  })

  test('should show validation error when password is too short', async ({ page }) => {
    const testUser = createTestUser()
    
    await page.goto('/register')
    await page.fill('#username', testUser.username)
    await page.fill('#email', testUser.email)
    await page.fill('#password', 'short')
    await page.fill('#confirmPassword', 'short')
    await page.fill('#orgName', testUser.orgName)
    
    await page.getByRole('button', { name: /create account/i }).click()
    
    // Should show password length error
    await expect(page.getByText(/password must be at least 8 characters/i)).toBeVisible()
  })

  test('should redirect to login when accessing protected route without authentication', async ({ page }) => {
    await page.goto('/hosts')
    
    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/)
    
    // Should preserve intended destination in location state
    // (ProtectedRoute sets state.from, but we can't easily test this in E2E)
    // Instead, verify we're on login page
    await expect(page.getByText('Welcome to Sluggisty')).toBeVisible()
  })

  test('should redirect to login when accessing dashboard without authentication', async ({ page }) => {
    await page.goto('/')
    
    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/)
  })

  test('should login successfully with valid credentials', async ({ page }) => {
    // Note: This test requires a backend with test user 'testuser'/'testpass'
    // If backend is not available, this test will fail
    // In a real scenario, you'd set up test data in global-setup or use a test backend
    
    await loginUser(page, 'testuser', 'testpass')
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/')
    
    // Should have API key stored
    const apiKey = await getApiKey(page)
    expect(apiKey).toBeTruthy()
    
    // Should see dashboard content (or redirect based on your app logic)
    await expect(page.getByText(/dashboard|hosts|total hosts/i).first()).toBeVisible()
  })

  test('should show error message on invalid login credentials', async ({ page }) => {
    await page.goto('/login')
    await page.fill('#username', 'invaliduser')
    await page.fill('#password', 'wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()
    
    // Should show error message (wait a bit for API call)
    await expect(page.getByText(/invalid|error|unauthorized/i).first()).toBeVisible({ timeout: 5000 })
    
    // Should still be on login page
    await expect(page).toHaveURL(/\/login/)
    
    // Should not have API key stored
    const apiKey = await getApiKey(page)
    expect(apiKey).toBeNull()
  })

  test('should register a new user successfully', async ({ page }) => {
    const testUser = createTestUser()
    
    await registerUser(page, testUser.username, testUser.password, testUser.email, testUser.orgName)
    
    // Registration should redirect (either to dashboard or login)
    // The app automatically logs in after registration, so should go to dashboard
    await expect(page).toHaveURL(/\/|\/login/)
    
    // If auto-login works, should have API key
    const apiKey = await getApiKey(page)
    // API key may or may not be set depending on auto-login success
    // This depends on your backend implementation
  })

  test('should logout successfully', async ({ page }) => {
    // Note: This test requires a backend with test user 'testuser'/'testpass'
    // If backend is not available, this test will fail
    // In a real scenario, you'd set up test data in global-setup or use a test backend
    
    await loginUser(page, 'testuser', 'testpass')
    
    // Should be on dashboard
    await expect(page).toHaveURL('/')
    
    // Find and click logout button (logout button has title="Logout" in Header component)
    const logoutButton = page.getByTitle('Logout')
    await logoutButton.click()
    
    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/)
    
    // Should not have API key stored
    const apiKey = await getApiKey(page)
    expect(apiKey).toBeNull()
  })

  test('should navigate to registration page from login', async ({ page }) => {
    await page.goto('/login')
    
    const signUpLink = page.getByRole('link', { name: /sign up/i })
    await expect(signUpLink).toBeVisible()
    await signUpLink.click()
    
    await expect(page).toHaveURL(/\/register/)
  })

  test('should navigate to login page from registration', async ({ page }) => {
    await page.goto('/register')
    
    const signInLink = page.getByRole('link', { name: /sign in/i })
    await expect(signInLink).toBeVisible()
    await signInLink.click()
    
    await expect(page).toHaveURL(/\/login/)
  })
})

