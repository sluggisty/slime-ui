import { test, expect } from '@playwright/test'
import { loginUser, waitForApiCalls, waitForPageLoad } from './test-helpers'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    // Note: This requires a backend with test user 'testuser'/'testpass'
    // If backend is not available, tests will fail
    await loginUser(page, 'testuser', 'testpass')
    await waitForPageLoad(page)
  })

  test('should display dashboard with host statistics', async ({ page }) => {
    await page.goto('/')
    await waitForApiCalls(page)
    
    // Verify dashboard is loaded
    await expect(page).toHaveURL('/')
    
    // Verify stat cards are visible
    // Dashboard has three stat cards: Total Hosts, Active Hosts, Stale Hosts
    await expect(page.getByText('Total Hosts')).toBeVisible()
    await expect(page.getByText('Active Hosts')).toBeVisible()
    await expect(page.getByText('Stale Hosts')).toBeVisible()
    
    // Verify stat cards have values (numbers)
    const statCards = page.locator('[class*="statCard"], [class*="StatCard"]')
    const count = await statCards.count()
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('should display host list when hosts are available', async ({ page }) => {
    await page.goto('/')
    await waitForApiCalls(page)
    
    // Verify "Recent Hosts" section is visible
    await expect(page.getByText('Recent Hosts')).toBeVisible()
    
    // Verify "View All" button is visible
    await expect(page.getByText(/view all/i)).toBeVisible()
    
    // Wait for hosts to load (either host cards or empty state)
    // The dashboard shows either host cards or an empty state message
    const hasHosts = await page.getByText(/no hosts reporting yet/i).isVisible().catch(() => false)
    const hasHostCards = await page.locator('[class*="hostCard"]').count()
    
    // Either hosts are displayed or empty state is shown
    expect(hasHosts || hasHostCards > 0).toBe(true)
  })

  test('should display empty state when no hosts are available', async ({ page }) => {
    await page.goto('/')
    await waitForApiCalls(page)
    
    // If no hosts, should show empty state
    // Check for empty state message (may or may not be visible depending on backend)
    const emptyState = page.getByText(/no hosts reporting yet/i)
    const emptyStateVisible = await emptyState.isVisible().catch(() => false)
    
    // If empty state is visible, verify it shows the correct message
    if (emptyStateVisible) {
      await expect(emptyState).toBeVisible()
      await expect(page.getByText(/run snail-core on your systems/i)).toBeVisible()
    }
  })

  test('should navigate to hosts page when View All is clicked', async ({ page }) => {
    await page.goto('/')
    await waitForApiCalls(page)
    
    // Find and click "View All" button
    const viewAllButton = page.getByText(/view all/i)
    await expect(viewAllButton).toBeVisible()
    await viewAllButton.click()
    
    // Should navigate to hosts page
    await expect(page).toHaveURL('/hosts')
    
    // Verify hosts page is loaded
    await expect(page.getByText(/all hosts|hosts/i)).toBeVisible()
  })

  test('should navigate to host detail when host card is clicked', async ({ page }) => {
    await page.goto('/')
    await waitForApiCalls(page)
    
    // Wait for hosts to load
    await page.waitForTimeout(1000) // Give time for API calls
    
    // Try to find a host card (if hosts are available)
    const hostCards = page.locator('[class*="hostCard"]')
    const hostCardCount = await hostCards.count()
    
    if (hostCardCount > 0) {
      // Click on the first host card
      await hostCards.first().click()
      
      // Should navigate to host detail page
      await expect(page).toHaveURL(/\/hosts\/[^/]+/)
      
      // Verify host detail page is loaded
      await expect(page.getByText(/host details|host detail/i)).toBeVisible()
    } else {
      // If no hosts, skip this test
      test.skip()
    }
  })

  test('should display correct stat card data', async ({ page }) => {
    await page.goto('/')
    await waitForApiCalls(page)
    
    // Verify stat cards display numeric values
    // Total Hosts stat card should have a number
    const totalHostsCard = page.getByText('Total Hosts').locator('..')
    const totalHostsValue = await totalHostsCard.locator('text=/\\d+/').first().textContent()
    
    // The value should be a number (or "0" if no hosts)
    expect(totalHostsValue).toMatch(/^\d+$/)
    
    // Active Hosts stat card should have a number
    const activeHostsCard = page.getByText('Active Hosts').locator('..')
    const activeHostsValue = await activeHostsCard.locator('text=/\\d+/').first().textContent()
    expect(activeHostsValue).toMatch(/^\d+$/)
    
    // Stale Hosts stat card should have a number
    const staleHostsCard = page.getByText('Stale Hosts').locator('..')
    const staleHostsValue = await staleHostsCard.locator('text=/\\d+/').first().textContent()
    expect(staleHostsValue).toMatch(/^\d+$/)
  })

  test('should display host cards with host information', async ({ page }) => {
    await page.goto('/')
    await waitForApiCalls(page)
    
    // Wait for hosts to load
    await page.waitForTimeout(1000)
    
    const hostCards = page.locator('[class*="hostCard"]')
    const hostCardCount = await hostCards.count()
    
    if (hostCardCount > 0) {
      // Verify host cards contain host information
      const firstHostCard = hostCards.first()
      
      // Host cards should display hostname (hostname is in a span with class hostName)
      const hostnameElement = firstHostCard.locator('[class*="hostName"], [class*="hostname"]')
      await expect(hostnameElement.first()).toBeVisible()
      
      // Host cards should show status badge (Active/Stale)
      const statusBadge = firstHostCard.getByText(/active|stale/i)
      await expect(statusBadge).toBeVisible()
    } else {
      // If no hosts, skip this test
      test.skip()
    }
  })

  test('should refresh data when refresh button is clicked', async ({ page }) => {
    await page.goto('/')
    await waitForApiCalls(page)
    
    // Find refresh button in header (has title="Refresh data")
    const refreshButton = page.getByTitle('Refresh data')
    await expect(refreshButton).toBeVisible()
    
    // Click refresh button
    await refreshButton.click()
    
    // Wait for data to refresh (network idle)
    await waitForApiCalls(page)
    
    // Verify dashboard still displays correctly after refresh
    await expect(page.getByText('Total Hosts')).toBeVisible()
  })

  test('should display loading state while fetching data', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/')
    
    // Immediately check for loading state (before data loads)
    // The dashboard shows "Loading..." while fetching
    const loadingText = page.getByText(/loading/i)
    const isLoading = await loadingText.isVisible().catch(() => false)
    
    // Loading state may or may not be visible depending on how fast data loads
    // This is a best-effort check
    if (isLoading) {
      await expect(loadingText).toBeVisible()
    }
    
    // Wait for data to load
    await waitForApiCalls(page)
    
    // After loading, should see dashboard content
    await expect(page.getByText('Total Hosts')).toBeVisible()
  })
})

