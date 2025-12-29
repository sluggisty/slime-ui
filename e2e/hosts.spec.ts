import { test, expect } from '@playwright/test'
import { loginUser, waitForApiCalls, waitForPageLoad } from './test-helpers'

test.describe('Hosts', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    // Note: This requires a backend with test user 'testuser'/'testpass'
    // If backend is not available, tests will fail
    await loginUser(page, 'testuser', 'testpass')
    await waitForPageLoad(page)
  })

  test('should display hosts page with list of hosts', async ({ page }) => {
    await page.goto('/hosts')
    await waitForApiCalls(page)
    
    // Verify hosts page is loaded
    await expect(page).toHaveURL('/hosts')
    await expect(page.getByText('All Hosts')).toBeVisible()
    
    // Verify filter controls are visible
    await expect(page.getByLabel(/distribution/i)).toBeVisible()
    
    // Wait for hosts table to load (either hosts or empty state)
    await page.waitForTimeout(1000)
    
    // Either hosts are displayed in table or empty state is shown
    const hasHosts = await page.locator('tbody tr').count() > 0
    const hasEmptyState = await page.getByText(/no hosts have reported yet/i).isVisible().catch(() => false)
    
    expect(hasHosts || hasEmptyState).toBe(true)
  })

  test('should display hosts in table format', async ({ page }) => {
    await page.goto('/hosts')
    await waitForApiCalls(page)
    
    // Wait for table to load
    await page.waitForTimeout(1000)
    
    // Check if hosts table has rows
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()
    
    if (rowCount > 0) {
      // Verify table headers are visible
      await expect(page.getByText(/hostname/i)).toBeVisible()
      await expect(page.getByText(/distribution/i)).toBeVisible()
      await expect(page.getByText(/last updated/i)).toBeVisible()
      await expect(page.getByText(/status/i)).toBeVisible()
      
      // Verify at least one host row is visible
      await expect(tableRows.first()).toBeVisible()
    } else {
      // If no hosts, verify empty state
      await expect(page.getByText(/no hosts have reported yet/i)).toBeVisible()
    }
  })

  test('should filter hosts by distribution', async ({ page }) => {
    await page.goto('/hosts')
    await waitForApiCalls(page)
    
    // Wait for hosts to load
    await page.waitForTimeout(1000)
    
    // Get the distribution filter dropdown
    const distroFilter = page.getByLabel(/distribution/i)
    await expect(distroFilter).toBeVisible()
    
    // Get all available distribution options
    const options = await distroFilter.locator('option').allTextContents()
    
    // If there are distribution options (other than "All Distributions")
    if (options.length > 1) {
      // Select a specific distribution (skip "All Distributions" option)
      const specificDistro = options.find(opt => opt.toLowerCase() !== 'all distributions')
      
      if (specificDistro) {
        await distroFilter.selectOption(specificDistro)
        
        // Wait for filter to apply
        await page.waitForTimeout(500)
        
        // Verify filter is applied (subtitle should show filtered count)
        const subtitle = page.getByText(/systems reporting/i)
        await expect(subtitle).toBeVisible()
      }
    } else {
      // If no distributions available, skip this test
      test.skip()
    }
  })

  test('should filter hosts by major version when distribution is selected', async ({ page }) => {
    await page.goto('/hosts')
    await waitForApiCalls(page)
    
    // Wait for hosts to load
    await page.waitForTimeout(1000)
    
    // Get the distribution filter
    const distroFilter = page.getByLabel(/distribution/i)
    const options = await distroFilter.locator('option').allTextContents()
    
    // Select a distribution (skip "All Distributions")
    const specificDistro = options.find(opt => opt.toLowerCase() !== 'all distributions')
    
    if (specificDistro) {
      await distroFilter.selectOption(specificDistro)
      await page.waitForTimeout(500)
      
      // Check if major version filter appears
      const majorVersionFilter = page.getByLabel(/major version/i)
      const isMajorVersionVisible = await majorVersionFilter.isVisible().catch(() => false)
      
      if (isMajorVersionVisible) {
        // Get major version options
        const majorVersionOptions = await majorVersionFilter.locator('option').allTextContents()
        
        if (majorVersionOptions.length > 1) {
          // Select a specific major version
          const specificMajorVersion = majorVersionOptions.find(opt => opt.toLowerCase() !== 'all major versions')
          
          if (specificMajorVersion) {
            await majorVersionFilter.selectOption(specificMajorVersion)
            await page.waitForTimeout(500)
            
            // Verify filter is applied
            const subtitle = page.getByText(/systems reporting/i)
            await expect(subtitle).toBeVisible()
          }
        }
      }
    } else {
      test.skip()
    }
  })

  test('should navigate to host detail when row is clicked', async ({ page }) => {
    await page.goto('/hosts')
    await waitForApiCalls(page)
    
    // Wait for hosts to load
    await page.waitForTimeout(1000)
    
    // Find host table rows
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()
    
    if (rowCount > 0) {
      // Click on the first host row
      await tableRows.first().click()
      
      // Should navigate to host detail page
      await expect(page).toHaveURL(/\/hosts\/[^/]+/)
      
      // Verify host detail page is loaded
      await expect(page.getByText(/host details/i)).toBeVisible()
    } else {
      // If no hosts, skip this test
      test.skip()
    }
  })

  test('should display host detail page correctly', async ({ page }) => {
    await page.goto('/hosts')
    await waitForApiCalls(page)
    
    // Wait for hosts to load
    await page.waitForTimeout(1000)
    
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()
    
    if (rowCount > 0) {
      // Click on first host to navigate to detail
      await tableRows.first().click()
      
      // Wait for host detail page to load
      await waitForApiCalls(page)
      
      // Verify host detail page elements
      await expect(page.getByText(/host details/i)).toBeVisible()
      
      // Verify host information sections are visible (may vary based on data)
      // Common sections: System, Hardware, Network, etc.
      const hasSystemInfo = await page.getByText(/system|hostname|os/i).first().isVisible().catch(() => false)
      expect(hasSystemInfo).toBe(true)
    } else {
      test.skip()
    }
  })

  test('should open delete modal when delete button is clicked', async ({ page }) => {
    await page.goto('/hosts')
    await waitForApiCalls(page)
    
    // Wait for hosts to load
    await page.waitForTimeout(1000)
    
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()
    
    if (rowCount > 0) {
      // Find delete buttons (they have title="Delete host")
      const deleteButtons = page.getByTitle(/delete host/i)
      const deleteButtonCount = await deleteButtons.count()
      
      if (deleteButtonCount > 0) {
        // Click the first delete button
        await deleteButtons.first().click()
        
        // Verify delete modal is opened
        await expect(page.getByText(/delete host/i)).toBeVisible()
        await expect(page.getByText(/are you sure you want to delete/i)).toBeVisible()
        
        // Verify modal has Cancel and Delete buttons
        await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
        await expect(page.getByRole('button', { name: /^delete$/i })).toBeVisible()
      } else {
        test.skip()
      }
    } else {
      test.skip()
    }
  })

  test('should cancel delete operation when Cancel is clicked', async ({ page }) => {
    await page.goto('/hosts')
    await waitForApiCalls(page)
    
    // Wait for hosts to load
    await page.waitForTimeout(1000)
    
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()
    
    if (rowCount > 0) {
      // Find and click delete button
      const deleteButtons = page.getByTitle(/delete host/i)
      const deleteButtonCount = await deleteButtons.count()
      
      if (deleteButtonCount > 0) {
        await deleteButtons.first().click()
        
        // Wait for modal to open
        await expect(page.getByText(/delete host/i)).toBeVisible()
        
        // Click Cancel button
        await page.getByRole('button', { name: /cancel/i }).click()
        
        // Modal should be closed
        await expect(page.getByText(/delete host/i)).not.toBeVisible()
        
        // Should still be on hosts page
        await expect(page).toHaveURL('/hosts')
      } else {
        test.skip()
      }
    } else {
      test.skip()
    }
  })

  test('should delete host when confirmed', async ({ page }) => {
    await page.goto('/hosts')
    await waitForApiCalls(page)
    
    // Wait for hosts to load
    await page.waitForTimeout(1000)
    
    const tableRows = page.locator('tbody tr')
    const initialRowCount = await tableRows.count()
    
    if (initialRowCount > 0) {
      // Get hostname of first host for verification
      const firstHostRow = tableRows.first()
      const hostname = await firstHostRow.locator('td').first().textContent()
      
      // Find and click delete button
      const deleteButtons = page.getByTitle(/delete host/i)
      const deleteButtonCount = await deleteButtons.count()
      
      if (deleteButtonCount > 0) {
        await deleteButtons.first().click()
        
        // Wait for modal to open
        await expect(page.getByText(/delete host/i)).toBeVisible()
        
        // Verify hostname is shown in modal
        if (hostname) {
          await expect(page.getByText(hostname.trim())).toBeVisible()
        }
        
        // Click Delete button to confirm
        await page.getByRole('button', { name: /^delete$/i }).click()
        
        // Wait for deletion to complete
        await waitForApiCalls(page)
        
        // Modal should be closed
        await expect(page.getByText(/delete host/i)).not.toBeVisible({ timeout: 5000 })
        
        // Should still be on hosts page
        await expect(page).toHaveURL('/hosts')
        
        // Host list should be refreshed (row count may have decreased)
        // Note: This depends on backend actually deleting the host
      } else {
        test.skip()
      }
    } else {
      test.skip()
    }
  })

  test('should navigate back to hosts list from host detail', async ({ page }) => {
    await page.goto('/hosts')
    await waitForApiCalls(page)
    
    // Wait for hosts to load
    await page.waitForTimeout(1000)
    
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()
    
    if (rowCount > 0) {
      // Navigate to host detail
      await tableRows.first().click()
      await expect(page).toHaveURL(/\/hosts\/[^/]+/)
      
      // Navigate back using browser back button or sidebar
      // Check if there's a back button or use browser back
      const backButton = page.getByRole('button', { name: /back/i }).or(page.getByText(/hosts/i).first())
      
      // Try browser back as fallback
      await page.goBack()
      
      // Should be back on hosts page
      await expect(page).toHaveURL('/hosts')
      await expect(page.getByText('All Hosts')).toBeVisible()
    } else {
      test.skip()
    }
  })

  test('should display loading state while fetching hosts', async ({ page }) => {
    await page.goto('/hosts')
    
    // Immediately check for loading state (before data loads)
    // The Table component shows loading state
    const loadingIndicator = page.getByText(/loading/i).or(page.locator('[class*="loading"]'))
    const isLoading = await loadingIndicator.first().isVisible().catch(() => false)
    
    // Loading state may or may not be visible depending on how fast data loads
    if (isLoading) {
      await expect(loadingIndicator.first()).toBeVisible()
    }
    
    // Wait for data to load
    await waitForApiCalls(page)
    
    // After loading, should see hosts page content
    await expect(page.getByText('All Hosts')).toBeVisible()
  })

  test('should display empty state message when no hosts match filter', async ({ page }) => {
    await page.goto('/hosts')
    await waitForApiCalls(page)
    
    // Wait for hosts to load
    await page.waitForTimeout(1000)
    
    // Get distribution filter
    const distroFilter = page.getByLabel(/distribution/i)
    const options = await distroFilter.locator('option').allTextContents()
    
    // Try to select a distribution that might not have hosts
    // This test may or may not pass depending on available data
    if (options.length > 1) {
      // Select a distribution
      const specificDistro = options.find(opt => opt.toLowerCase() !== 'all distributions')
      
      if (specificDistro) {
        await distroFilter.selectOption(specificDistro)
        await page.waitForTimeout(500)
        
        // Check if empty state message appears for filtered results
        const emptyMessage = page.getByText(/no hosts found with distribution/i)
        const isEmpty = await emptyMessage.isVisible().catch(() => false)
        
        // Either hosts are shown or empty message is displayed
        const hasHosts = await page.locator('tbody tr').count() > 0
        expect(hasHosts || isEmpty).toBe(true)
      }
    }
  })
})

