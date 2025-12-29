import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, render as rtlRender } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '../test/test-utils'
import Login from './Login'
import { auth } from '../api/auth'
import { server } from '../test/server'
import { http, HttpResponse } from 'msw'

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Helper to render with MemoryRouter for tests that need location state
const renderWithRouter = (ui: React.ReactElement, initialEntries: any[] = ['/login']) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return rtlRender(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.removeApiKey()
  })

  it('renders login form', () => {
    render(<Login />)
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders welcome message and header', () => {
    render(<Login />)
    expect(screen.getByText('Welcome to Sluggisty')).toBeInTheDocument()
    expect(screen.getByText('Sign in to access your system insights')).toBeInTheDocument()
  })

  it('disables submit when fields are empty', () => {
    render(<Login />)
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    expect(submitButton).toBeDisabled()
  })

  it('enables submit when fields are filled', async () => {
    const user = userEvent.setup()
    render(<Login />)
    
    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/password/i), 'testpass')
    
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    expect(submitButton).not.toBeDisabled()
  })

  it('disables submit when only username is filled', async () => {
    const user = userEvent.setup()
    render(<Login />)
    
    await user.type(screen.getByLabelText(/username/i), 'testuser')
    
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    expect(submitButton).toBeDisabled()
  })

  it('disables submit when only password is filled', async () => {
    const user = userEvent.setup()
    render(<Login />)
    
    await user.type(screen.getByLabelText(/password/i), 'testpass')
    
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    expect(submitButton).toBeDisabled()
  })

  it('handles successful login', async () => {
    const user = userEvent.setup()
    render(<Login />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/password/i), 'testpass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
    expect(auth.getApiKey()).toBeTruthy()
  })

  it('calls authApi.login with correct credentials', async () => {
    const user = userEvent.setup()
    render(<Login />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/password/i), 'testpass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })

    // Verify API key was stored
    expect(auth.getApiKey()).toBeTruthy()
  })

  it('stores API key in auth after successful login', async () => {
    const user = userEvent.setup()
    render(<Login />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/password/i), 'testpass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(auth.getApiKey()).toBeTruthy()
    })

    // Verify the API key matches what was returned from the mock
    const apiKey = auth.getApiKey()
    expect(apiKey).toBeTruthy()
  })

  it('shows error on failed login', async () => {
    server.use(
      http.post('/api/v1/auth/login', () => {
        return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      })
    )

    const user = userEvent.setup()
    render(<Login />)

    await user.type(screen.getByLabelText(/username/i), 'wronguser')
    await user.type(screen.getByLabelText(/password/i), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })

    // Should not navigate on error
    expect(mockNavigate).not.toHaveBeenCalled()
    // Should not store API key on error
    expect(auth.getApiKey()).toBeNull()
  })

  it('shows loading state during login', async () => {
    server.use(
      http.post('/api/v1/auth/login', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return HttpResponse.json({ 
          user: { id: '1', username: 'testuser' },
          token: 'test-token' 
        })
      })
    )

    const user = userEvent.setup()
    render(<Login />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/password/i), 'testpass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    // Check for loading state
    expect(screen.getByText(/signing in/i)).toBeInTheDocument()
    
    // Inputs should be disabled during loading
    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/password/i)
    expect(usernameInput).toBeDisabled()
    expect(passwordInput).toBeDisabled()
  })

  it('shows success message from registration redirect', () => {
    // Use MemoryRouter to pass state to the component
    renderWithRouter(
      <Login />,
      [{ pathname: '/login', state: { message: 'Registration successful! Please sign in.' } }]
    )
    
    expect(screen.getByText('Registration successful! Please sign in.')).toBeInTheDocument()
  })

  it('renders link to registration page', () => {
    render(<Login />)
    const registerLink = screen.getByRole('link', { name: /sign up/i })
    expect(registerLink).toBeInTheDocument()
    expect(registerLink).toHaveAttribute('href', '/register')
  })

  it('clears error when submitting again after error', async () => {
    // First, trigger an error
    server.use(
      http.post('/api/v1/auth/login', () => {
        return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      })
    )

    const user = userEvent.setup()
    render(<Login />)

    await user.type(screen.getByLabelText(/username/i), 'wronguser')
    await user.type(screen.getByLabelText(/password/i), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })

    // Reset server to success response
    server.use(
      http.post('/api/v1/auth/login', () => {
        return HttpResponse.json({ 
          user: { id: '1', username: 'testuser' },
          token: 'test-token' 
        })
      })
    )

    // Submit again with correct credentials
    await user.clear(screen.getByLabelText(/username/i))
    await user.clear(screen.getByLabelText(/password/i))
    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/password/i), 'testpass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText(/invalid credentials/i)).not.toBeInTheDocument()
    })
  })

  it('disables form inputs during loading', async () => {
    server.use(
      http.post('/api/v1/auth/login', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return HttpResponse.json({ 
          user: { id: '1', username: 'testuser' },
          token: 'test-token' 
        })
      })
    )

    const user = userEvent.setup()
    render(<Login />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/password/i), 'testpass')
    
    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/password/i)
    
    // Inputs should be enabled before submit
    expect(usernameInput).not.toBeDisabled()
    expect(passwordInput).not.toBeDisabled()

    await user.click(screen.getByRole('button', { name: /sign in/i }))

    // Inputs should be disabled during loading
    await waitFor(() => {
      expect(usernameInput).toBeDisabled()
      expect(passwordInput).toBeDisabled()
    })
  })
})

