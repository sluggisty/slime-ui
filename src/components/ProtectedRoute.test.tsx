import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProtectedRoute from './ProtectedRoute'
import { auth } from '../api/auth'

// Mock the auth module
vi.mock('../api/auth', () => ({
  auth: {
    isAuthenticated: vi.fn(),
  },
}))

// Helper component to capture location state for testing
function LocationDisplay() {
  const location = useLocation()
  return (
    <div data-testid="location-display">
      {JSON.stringify({
        pathname: location.pathname,
        state: location.state,
      })}
    </div>
  )
}

// Helper to render with MemoryRouter and Routes for testing redirects
const renderWithRoutes = (initialPath: string = '/') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path={initialPath}
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={
              <div>
                <div>Login Page</div>
                <LocationDisplay />
              </div>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children when user is authenticated', () => {
    vi.mocked(auth.isAuthenticated).mockReturnValue(true)

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('redirects to /login when user is not authenticated', () => {
    vi.mocked(auth.isAuthenticated).mockReturnValue(false)

    renderWithRoutes('/protected')

    // Should redirect to /login - children should not be rendered
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    
    // Verify we're at /login
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('preserves intended destination in location state for redirect after login', () => {
    vi.mocked(auth.isAuthenticated).mockReturnValue(false)

    renderWithRoutes('/dashboard')

    // Content should not be rendered when not authenticated
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    
    // Verify we're at /login
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    
    // Verify location state contains the intended destination
    const locationDisplay = screen.getByTestId('location-display')
    const location = JSON.parse(locationDisplay.textContent || '{}')
    expect(location.pathname).toBe('/login')
    expect(location.state).toEqual({ from: '/dashboard' })
  })

  it('preserves intended destination for nested routes', () => {
    vi.mocked(auth.isAuthenticated).mockReturnValue(false)

    renderWithRoutes('/hosts/123')

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    
    // Verify we're at /login
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    
    // Verify location state contains the intended destination
    const locationDisplay = screen.getByTestId('location-display')
    const location = JSON.parse(locationDisplay.textContent || '{}')
    expect(location.pathname).toBe('/login')
    expect(location.state).toEqual({ from: '/hosts/123' })
  })
})

