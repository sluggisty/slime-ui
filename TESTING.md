# Testing Guide

This document provides comprehensive information about testing in the Slime UI project, including how to run tests, test organization, writing guidelines, common patterns, and troubleshooting.

## Table of Contents

- [Running Tests](#running-tests)
- [Test Structure and Organization](#test-structure-and-organization)
- [Writing New Tests](#writing-new-tests)
- [Common Testing Patterns](#common-testing-patterns)
- [Troubleshooting](#troubleshooting)

---

## Running Tests

### Unit and Integration Tests (Vitest)

Unit and integration tests use Vitest and React Testing Library. These tests run in a Node.js environment with jsdom and don't require a browser or backend server.

```bash
# Run tests in watch mode (reruns on file changes)
npm test

# Run tests once (CI mode)
npm run test:run

# Run tests with UI (interactive mode)
npm run test:ui

# Generate coverage report
npm run test:coverage
```

**Note:** Unit/integration tests use MSW (Mock Service Worker) to mock API calls, so no backend server is required.

### End-to-End Tests (Playwright)

E2E tests use Playwright to test the application in real browsers. These tests require **both** the frontend dev server and the backend API to be running.

**Prerequisites:**
- Backend API (snailbus) must be running on `http://localhost:8080`
- The frontend dev server will be started automatically by Playwright

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI mode (interactive)
npm run test:e2e:ui

# Run E2E tests in debug mode
npm run test:e2e:debug

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed

# View last test report
npm run test:e2e:report
```

**Important:** If you see `ECONNREFUSED` errors, ensure the snailbus API is running on port 8080. The frontend dev server starts automatically via Playwright's `webServer` configuration.

---

## Test Structure and Organization

### Directory Structure

```
slime-ui/
├── src/
│   ├── components/
│   │   ├── Card.tsx
│   │   ├── Card.test.tsx          # Component unit tests
│   │   └── ...
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Dashboard.test.tsx     # Page integration tests
│   │   └── ...
│   ├── api/
│   │   ├── client.ts
│   │   ├── client.test.ts         # API client tests
│   │   └── ...
│   └── test/
│       ├── setup.ts               # Vitest global setup
│       ├── test-utils.tsx         # Custom render function & utilities
│       ├── mockData.ts            # Mock data factories
│       ├── handlers.ts            # MSW API handlers
│       └── server.ts              # MSW server configuration
├── e2e/
│   ├── auth.spec.ts               # E2E auth tests
│   ├── dashboard.spec.ts          # E2E dashboard tests
│   ├── hosts.spec.ts              # E2E hosts tests
│   ├── fixtures.ts                # Playwright custom fixtures
│   ├── test-helpers.ts            # E2E helper functions
│   └── global-setup.ts            # Playwright global setup
├── vitest.config.ts               # Vitest configuration
└── playwright.config.ts           # Playwright configuration
```

### Test Naming Conventions

- **Unit/Integration Tests:** `*.test.tsx` or `*.test.ts` (e.g., `Card.test.tsx`)
- **E2E Tests:** `*.spec.ts` (e.g., `auth.spec.ts`)

### Test File Organization

- Test files should be colocated with the files they test (e.g., `Card.test.tsx` next to `Card.tsx`)
- E2E tests are organized in the `e2e/` directory
- Shared test utilities are in `src/test/` for unit tests and `e2e/` for E2E tests

---

## Writing New Tests

### Unit/Integration Tests (Vitest + React Testing Library)

#### Basic Test Structure

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '../test/test-utils'
import { MyComponent } from './MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('handles user interactions', async () => {
    const handleClick = vi.fn()
    render(<MyComponent onClick={handleClick} />)
    
    await userEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

#### Key Points

1. **Always use the custom `render` from `test-utils.tsx`** - This automatically wraps your component with required providers (QueryClient, BrowserRouter)
2. **Import from `test-utils.tsx`** - This re-exports everything from `@testing-library/react`
3. **Use descriptive test names** - Test names should clearly describe what is being tested
4. **Test user behavior, not implementation** - Focus on what users see and do

#### Testing Components

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../test/test-utils'
import { Card } from './Card'

describe('Card', () => {
  it('renders children correctly', () => {
    render(<Card>Test Content</Card>)
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('handles onClick events', () => {
    const handleClick = vi.fn()
    render(<Card onClick={handleClick}>Clickable</Card>)
    screen.getByText('Clickable').click()
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

#### Testing Pages (with API Calls)

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import { Dashboard } from './Dashboard'
import * as api from '../api/client'

describe('Dashboard', () => {
  it('displays host statistics', async () => {
    // MSW automatically mocks the API call
    render(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Total Hosts')).toBeInTheDocument()
    })
  })
})
```

#### Testing API Functions

For API client tests, you need to set `process.env.TEST_API_CLIENT = 'true'` to enable URL conversion:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { api } from './client'

describe('API Client', () => {
  beforeAll(() => {
    process.env.TEST_API_CLIENT = 'true'
  })

  afterAll(() => {
    delete process.env.TEST_API_CLIENT
  })

  it('fetches hosts successfully', async () => {
    const hosts = await api.getHosts()
    expect(hosts).toBeDefined()
  })
})
```

### E2E Tests (Playwright)

#### Basic Test Structure

```typescript
import { test, expect } from './fixtures'
import { waitForApiCalls } from './test-helpers'

test.describe('My Feature', () => {
  test('should display feature correctly', async ({ authenticatedPage }) => {
    const page = authenticatedPage
    await page.goto('/my-feature')
    await waitForApiCalls(page)
    
    await expect(page.getByText('My Feature')).toBeVisible()
  })
})
```

#### Key Points

1. **Use `authenticatedPage` fixture** - For tests that require authentication (most tests)
2. **Use regular `page` fixture** - Only for tests that specifically test authentication flows
3. **Import from `./fixtures`** - This provides the custom fixtures and re-exports `expect`
4. **Wait for API calls** - Use `waitForApiCalls()` helper when testing pages that fetch data

#### Testing Authenticated Routes

```typescript
import { test, expect } from './fixtures'
import { waitForApiCalls } from './test-helpers'

test.describe('Dashboard', () => {
  test('should display dashboard', async ({ authenticatedPage }) => {
    const page = authenticatedPage
    await page.goto('/')
    await waitForApiCalls(page)
    
    await expect(page.getByText('Total Hosts')).toBeVisible()
  })
})
```

#### Testing Authentication Flows

```typescript
import { test, expect } from '@playwright/test'
import { loginUser, clearAuth } from './test-helpers'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page)
  })

  test('should login successfully', async ({ page }) => {
    await loginUser(page, 'testuser', 'testpass')
    await expect(page).toHaveURL('/')
  })
})
```

---

## Common Testing Patterns

### 1. Custom Render Function

Always use the custom `render` function from `test-utils.tsx` which provides:
- `QueryClientProvider` (TanStack Query)
- `BrowserRouter` (React Router)
- Proper test configuration

```typescript
import { render, screen } from '../test/test-utils'
```

### 2. Mock Data Factories

Use factory functions from `mockData.ts` to generate test data:

```typescript
import { createMockHost, createMockReport } from '../test/mockData'

const host = createMockHost({ hostname: 'test-host' })
const report = createMockReport({ hostname: 'test-host' })
```

### 3. API Mocking with MSW

MSW automatically intercepts API calls in tests. Handlers are defined in `src/test/handlers.ts`:

```typescript
// MSW automatically mocks the API - no manual setup needed
render(<Dashboard />)
// The component's API calls are automatically mocked
```

### 4. Testing User Interactions

Use `@testing-library/user-event` for realistic user interactions:

```typescript
import userEvent from '@testing-library/user-event'

const user = userEvent.setup()
await user.click(screen.getByRole('button'))
await user.type(screen.getByLabelText('Username'), 'testuser')
```

### 5. Testing Async Behavior

Use `waitFor` for async operations:

```typescript
import { waitFor } from '../test/test-utils'

await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
})
```

### 6. Testing with React Router

The custom render function includes `BrowserRouter`, but for route-specific tests, use `MemoryRouter`:

```typescript
import { MemoryRouter } from 'react-router-dom'
import { render } from '../test/test-utils'

render(
  <MemoryRouter initialEntries={['/login']}>
    <MyComponent />
  </MemoryRouter>
)
```

### 7. E2E Test Helpers

Use helpers from `e2e/test-helpers.ts` for common operations:

```typescript
import { loginUser, waitForApiCalls, navigateTo } from './test-helpers'

await loginUser(page, 'testuser', 'testpass')
await waitForApiCalls(page)
await navigateTo(page, '/hosts')
```

### 8. Playwright Fixtures

Use custom fixtures for authenticated tests:

```typescript
import { test, expect } from './fixtures'

test('my test', async ({ authenticatedPage }) => {
  // User is already logged in
  await authenticatedPage.goto('/dashboard')
})
```

---

## Troubleshooting

### Common Issues

#### 1. "No QueryClient set, use QueryClientProvider to set one"

**Problem:** Component uses TanStack Query but isn't wrapped in `QueryClientProvider`.

**Solution:** Always use the custom `render` function from `test-utils.tsx`:

```typescript
// ❌ Wrong
import { render } from '@testing-library/react'

// ✅ Correct
import { render } from '../test/test-utils'
```

#### 2. "Error: You cannot render a <Router> inside another <Router>"

**Problem:** Component is already wrapped in `BrowserRouter` by the custom render function, but you're adding another router.

**Solution:** For route-specific tests, use `MemoryRouter` directly or access the router from the custom render:

```typescript
// ✅ Correct - use MemoryRouter when needed
import { MemoryRouter } from 'react-router-dom'
render(
  <MemoryRouter initialEntries={['/login']}>
    <MyComponent />
  </MemoryRouter>
)
```

#### 3. "TypeError: Invalid URL" in API Client Tests

**Problem:** Node.js `fetch` requires absolute URLs, but the API client uses relative URLs.

**Solution:** Set `process.env.TEST_API_CLIENT = 'true'` in `beforeAll`:

```typescript
beforeAll(() => {
  process.env.TEST_API_CLIENT = 'true'
})

afterAll(() => {
  delete process.env.TEST_API_CLIENT
})
```

#### 4. "ECONNREFUSED" Errors in E2E Tests

**Problem:** Backend API server is not running.

**Solution:** Start the snailbus API server on `http://localhost:8080` before running E2E tests.

#### 5. Tests Pass Individually but Fail When Run Together

**Problem:** Tests are not properly isolated - state is leaking between tests.

**Solution:**
- Ensure MSW handlers are reset between tests (automatically handled)
- Clear localStorage/sessionStorage in `beforeEach` if needed
- Use unique test data for each test
- Avoid global state mutations

#### 6. "Found multiple elements with the text: X"

**Problem:** Multiple elements match the query.

**Solution:** Use more specific queries:

```typescript
// ❌ Too broad
screen.getByText('Hostname')

// ✅ More specific
screen.getByLabelText('Hostname')
screen.getByRole('cell', { name: 'Hostname' })
within(modal).getByText('Hostname')
```

#### 7. E2E Tests Timing Out

**Problem:** Tests are waiting for elements that never appear or API calls that never complete.

**Solution:**
- Use `waitForApiCalls()` helper after navigation
- Increase timeout for slow operations: `await expect(element).toBeVisible({ timeout: 10000 })`
- Check if backend API is responding correctly
- Verify network requests in browser DevTools

#### 8. MSW Not Intercepting Requests

**Problem:** MSW server is not started or handlers are incorrect.

**Solution:**
- Ensure `src/test/server.ts` is imported in `src/test/setup.ts`
- Verify handlers in `src/test/handlers.ts` match the actual API endpoints
- Check that handlers use correct HTTP methods and paths

#### 9. "Cannot find module" Errors

**Problem:** TypeScript or module resolution issues.

**Solution:**
- Ensure `vitest.config.ts` has correct path aliases configured
- Check `tsconfig.json` for proper module resolution settings
- Verify imports use correct paths (relative or absolute)

#### 10. Playwright Browser Not Found

**Problem:** Playwright browsers are not installed.

**Solution:**
```bash
npx playwright install
```

---

## Best Practices

### Unit/Integration Tests

1. **Test behavior, not implementation** - Focus on user-visible behavior
2. **Use MSW for API mocking** - Keep tests isolated and fast
3. **Test user interactions** - Use `@testing-library/user-event`
4. **Keep tests independent** - Each test should run in isolation
5. **Use descriptive test names** - Clearly describe what is being tested
6. **Avoid testing third-party code** - Don't test React, React Router, or TanStack Query
7. **Test error cases** - Don't just test the happy path
8. **Keep tests fast** - Use mocks instead of real API calls

### E2E Tests

1. **Test critical user flows** - Focus on complete user journeys
2. **Use fixtures for authentication** - Leverage `authenticatedPage` fixture
3. **Write stable selectors** - Prefer semantic selectors over CSS classes
4. **Wait properly** - Use Playwright's auto-waiting features
5. **Test across browsers** - Run tests on multiple browsers
6. **Keep tests independent** - Each test should clean up after itself
7. **Use screenshots and videos** - Configure failure artifacts for debugging

---

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library Documentation](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [MSW Documentation](https://mswjs.io/)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)


