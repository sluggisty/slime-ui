import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../test/test-utils'
import Register from './Register'
import { auth, authApi } from '../api/auth'
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

describe('Register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.removeApiKey()
  })

  it('renders registration form', () => {
    render(<Register />)
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/organization name/i)).toBeInTheDocument()
  })

  it('renders header and title', () => {
    render(<Register />)
    const headings = screen.getAllByText('Create Account')
    expect(headings.length).toBeGreaterThan(0)
    expect(screen.getByText('Sign up to get started with Sluggisty')).toBeInTheDocument()
  })

  it('disables submit when fields are empty', () => {
    render(<Register />)
    const submitButton = screen.getByRole('button', { name: /create account/i })
    expect(submitButton).toBeDisabled()
  })

  it('enables submit when all fields are filled', async () => {
    const user = userEvent.setup()
    render(<Register />)
    
    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'password123')
    await user.type(screen.getByLabelText(/organization name/i), 'Test Org')
    
    const submitButton = screen.getByRole('button', { name: /create account/i })
    expect(submitButton).not.toBeDisabled()
  })

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()
    render(<Register />)
    
    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'password456')
    await user.type(screen.getByLabelText(/organization name/i), 'Test Org')
    
    await user.click(screen.getByRole('button', { name: /create account/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })
  })

  it('shows error when password is too short', async () => {
    const user = userEvent.setup()
    render(<Register />)
    
    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'short')
    await user.type(screen.getByLabelText(/confirm password/i), 'short')
    await user.type(screen.getByLabelText(/organization name/i), 'Test Org')
    
    await user.click(screen.getByRole('button', { name: /create account/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument()
    })
  })

  it('handles successful registration and auto-login', async () => {
    const user = userEvent.setup()
    render(<Register />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'password123')
    await user.type(screen.getByLabelText(/organization name/i), 'Test Org')
    
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
    expect(auth.getApiKey()).toBeTruthy()
  })

  it('shows error on failed registration', async () => {
    server.use(
      http.post('/api/v1/auth/register', () => {
        return HttpResponse.json({ error: 'Username already exists' }, { status: 400 })
      })
    )

    const user = userEvent.setup()
    render(<Register />)

    await user.type(screen.getByLabelText(/username/i), 'existinguser')
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'password123')
    await user.type(screen.getByLabelText(/organization name/i), 'Test Org')
    
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/username already exists/i)).toBeInTheDocument()
    })
    
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('redirects to login if auto-login fails after registration', async () => {
    server.use(
      http.post('/api/v1/auth/register', () => {
        return HttpResponse.json({ id: '1', username: 'testuser', email: 'test@example.com' }, { status: 201 })
      }),
      http.post('/api/v1/auth/login', () => {
        return HttpResponse.json({ error: 'Login failed' }, { status: 401 })
      })
    )

    const user = userEvent.setup()
    render(<Register />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'password123')
    await user.type(screen.getByLabelText(/organization name/i), 'Test Org')
    
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', expect.objectContaining({
        state: expect.objectContaining({
          message: 'Registration successful! Please sign in.'
        })
      }))
    })
  })

  it('shows loading state during registration', async () => {
    server.use(
      http.post('/api/v1/auth/register', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return HttpResponse.json({ id: '1', username: 'testuser' }, { status: 201 })
      })
    )

    const user = userEvent.setup()
    render(<Register />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'password123')
    await user.type(screen.getByLabelText(/organization name/i), 'Test Org')
    
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(screen.getByText(/creating account/i)).toBeInTheDocument()
  })

  it('renders link to login page', () => {
    render(<Register />)
    const loginLink = screen.getByRole('link', { name: /sign in/i })
    expect(loginLink).toBeInTheDocument()
    expect(loginLink).toHaveAttribute('href', '/login')
  })
})

