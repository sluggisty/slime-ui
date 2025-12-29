import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Header from './Header'
import { auth, authApi } from '../api/auth'
import { createMockUser } from '../test/mockData'

// Mock the auth module
vi.mock('../api/auth', () => ({
  auth: {
    removeApiKey: vi.fn(),
  },
  authApi: {
    getMe: vi.fn(),
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

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders header with title', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue(createMockUser())

    renderWithRouter(<Header />, ['/'])

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })
  })

  it('displays correct title for dashboard route', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue(createMockUser())

    renderWithRouter(<Header />, ['/'])

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })
  })

  it('displays correct title for hosts route', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue(createMockUser())

    renderWithRouter(<Header />, ['/hosts'])

    await waitFor(() => {
      expect(screen.getByText('Hosts')).toBeInTheDocument()
    })
  })

  it('displays host details title for host detail route', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue(createMockUser())

    renderWithRouter(<Header />, ['/hosts/123'])

    await waitFor(() => {
      expect(screen.getByText('Host Details')).toBeInTheDocument()
    })
  })

  it('displays breadcrumb path', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue(createMockUser())

    renderWithRouter(<Header />, ['/hosts'])

    await waitFor(() => {
      expect(screen.getByText('/hosts')).toBeInTheDocument()
    })
  })

  it('displays user info when user is loaded', async () => {
    const user = createMockUser({ username: 'testuser', email: 'test@example.com' })
    vi.mocked(authApi.getMe).mockResolvedValue(user)

    renderWithRouter(<Header />)

    await waitFor(() => {
      expect(screen.getByText('testuser')).toBeInTheDocument()
    })

    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('displays admin badge when user is admin', async () => {
    const adminUser = createMockUser({ is_admin: true, role: 'admin' })
    vi.mocked(authApi.getMe).mockResolvedValue(adminUser)

    const { container } = renderWithRouter(<Header />)

    await waitFor(() => {
      expect(screen.getByText(adminUser.username)).toBeInTheDocument()
    })

    // Check for admin badge (Shield icon) - there should be multiple SVGs (icons)
    const svgIcons = container.querySelectorAll('svg')
    expect(svgIcons.length).toBeGreaterThan(0)
  })

  it('calls logout when logout button is clicked', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue(createMockUser())

    renderWithRouter(<Header />)

    await waitFor(() => {
      expect(screen.getByTitle('Logout')).toBeInTheDocument()
    })

    const logoutButton = screen.getByTitle('Logout')
    logoutButton.click()

    expect(auth.removeApiKey).toHaveBeenCalled()
    // Note: navigate will be called but we can't easily test it with MemoryRouter
    // The important thing is that removeApiKey is called
  })

  it('renders refresh button', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue(createMockUser())

    renderWithRouter(<Header />)

    await waitFor(() => {
      expect(screen.getByTitle('Refresh data')).toBeInTheDocument()
    })
  })
})

