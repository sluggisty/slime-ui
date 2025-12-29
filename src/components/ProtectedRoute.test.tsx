import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProtectedRoute from './ProtectedRoute'
import { auth } from '../api/auth'

// Mock the auth module
vi.mock('../api/auth', () => ({
  auth: {
    isAuthenticated: vi.fn(),
  },
}))

// Helper to render with MemoryRouter (without BrowserRouter from test-utils)
const renderWithRouter = (ui: React.ReactElement, initialEntries: string[] = ['/']) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
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

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('redirects to login when user is not authenticated', () => {
    vi.mocked(auth.isAuthenticated).mockReturnValue(false)

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      ['/protected']
    )

    // Should redirect to /login - children should not be rendered
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('does not render children when user is not authenticated', () => {
    vi.mocked(auth.isAuthenticated).mockReturnValue(false)

    renderWithRouter(
      <ProtectedRoute>
        <div>Dashboard Content</div>
      </ProtectedRoute>,
      ['/dashboard']
    )

    // Content should not be rendered when not authenticated
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument()
  })
})

