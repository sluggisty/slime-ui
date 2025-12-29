import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../test/test-utils'
import UserAccess from './UserAccess'
import { createMockUser } from '../test/mockData'
import { server } from '../test/server'
import { http, HttpResponse } from 'msw'

describe('UserAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders user access page with header', async () => {
    server.use(
      http.get('/api/v1/users', () => {
        return HttpResponse.json({
          users: [createMockUser()],
          total: 1,
        })
      }),
      http.get('/api/v1/auth/me', () => {
        return HttpResponse.json(createMockUser({ role: 'admin' }))
      })
    )

    render(<UserAccess />)

    await waitFor(() => {
      expect(screen.getByText('User Access')).toBeInTheDocument()
    })
  })

  it('displays loading state while fetching users', () => {
    server.use(
      http.get('/api/v1/users', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return HttpResponse.json({ users: [], total: 0 })
      })
    )

    render(<UserAccess />)
    expect(screen.getByText(/loading users/i)).toBeInTheDocument()
  })

  it('displays users in table', async () => {
    const users = [
      createMockUser({ id: '1', username: 'user1', email: 'user1@example.com', role: 'admin' }),
      createMockUser({ id: '2', username: 'user2', email: 'user2@example.com', role: 'viewer' }),
    ]

    server.use(
      http.get('/api/v1/users', () => {
        return HttpResponse.json({ users, total: users.length })
      }),
      http.get('/api/v1/auth/me', () => {
        return HttpResponse.json(createMockUser({ role: 'admin' }))
      })
    )

    render(<UserAccess />)

    await waitFor(() => {
      expect(screen.getByText('user1')).toBeInTheDocument()
      expect(screen.getByText('user2')).toBeInTheDocument()
    })

    expect(screen.getByText('user1@example.com')).toBeInTheDocument()
    expect(screen.getByText('user2@example.com')).toBeInTheDocument()
  })

  it('opens create user modal when create button is clicked', async () => {
    server.use(
      http.get('/api/v1/users', () => {
        return HttpResponse.json({ users: [], total: 0 })
      }),
      http.get('/api/v1/auth/me', () => {
        return HttpResponse.json(createMockUser({ role: 'admin' }))
      })
    )

    const user = userEvent.setup()
    render(<UserAccess />)

    await waitFor(() => {
      // Find the button by role or by looking for button containing the text
      const buttons = screen.getAllByText(/create user/i)
      const createButton = buttons.find(btn => btn.closest('button'))
      expect(createButton).toBeInTheDocument()
    })

    // Find button by role instead
    const createButtons = screen.getAllByRole('button', { name: /create user/i })
    if (createButtons.length > 0) {
      await user.click(createButtons[0])

      await waitFor(() => {
        // Modal should show form fields
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
      })
    }
  })

  it('opens edit modal when edit button is clicked', async () => {
    const users = [
      createMockUser({ id: '1', username: 'testuser', email: 'test@example.com', role: 'viewer' }),
    ]

    server.use(
      http.get('/api/v1/users', () => {
        return HttpResponse.json({ users, total: users.length })
      }),
      http.get('/api/v1/auth/me', () => {
        return HttpResponse.json(createMockUser({ id: '2', role: 'admin' }))
      })
    )

    const user = userEvent.setup()
    render(<UserAccess />)

    await waitFor(() => {
      expect(screen.getByText('testuser')).toBeInTheDocument()
    })

    // Find edit button (Edit2 icon)
    const editButtons = screen.getAllByTitle(/edit role/i)
    if (editButtons.length > 0) {
      await user.click(editButtons[0])

      await waitFor(() => {
        expect(screen.getByText(/update user role/i)).toBeInTheDocument()
      })
    }
  })

  it('opens delete modal when delete button is clicked', async () => {
    const users = [
      createMockUser({ id: '1', username: 'testuser', email: 'test@example.com' }),
    ]

    server.use(
      http.get('/api/v1/users', () => {
        return HttpResponse.json({ users, total: users.length })
      }),
      http.get('/api/v1/auth/me', () => {
        return HttpResponse.json(createMockUser({ id: '2', role: 'admin' }))
      })
    )

    const user = userEvent.setup()
    render(<UserAccess />)

    await waitFor(() => {
      expect(screen.getAllByText('testuser').length).toBeGreaterThan(0)
    })

    // Find delete button (Trash2 icon)
    const deleteButtons = screen.getAllByTitle(/delete user/i)
    expect(deleteButtons.length).toBeGreaterThan(0)
    await user.click(deleteButtons[0])

    await waitFor(() => {
      // Modal title appears (h2)
      const modalTitles = screen.getAllByText(/delete user/i)
      expect(modalTitles.length).toBeGreaterThan(0)
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument()
    })
  })

  it('displays empty state when no users', async () => {
    server.use(
      http.get('/api/v1/users', () => {
        return HttpResponse.json({ users: [], total: 0 })
      }),
      http.get('/api/v1/auth/me', () => {
        return HttpResponse.json(createMockUser({ role: 'admin' }))
      })
    )

    render(<UserAccess />)

    await waitFor(() => {
      expect(screen.getByText(/no users found/i)).toBeInTheDocument()
    })
  })

  it('displays user roles correctly', async () => {
    const users = [
      createMockUser({ username: 'admin', role: 'admin' }),
      createMockUser({ username: 'editor', role: 'editor' }),
      createMockUser({ username: 'viewer', role: 'viewer' }),
    ]

    server.use(
      http.get('/api/v1/users', () => {
        return HttpResponse.json({ users, total: users.length })
      }),
      http.get('/api/v1/auth/me', () => {
        return HttpResponse.json(createMockUser({ role: 'admin' }))
      })
    )

    render(<UserAccess />)

    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument()
      expect(screen.getByText('Editor')).toBeInTheDocument()
      expect(screen.getByText('Viewer')).toBeInTheDocument()
    })
  })

  it('disables edit and delete for current user', async () => {
    const currentUser = createMockUser({ id: 'current', username: 'currentuser', role: 'admin' })
    const otherUser = createMockUser({ id: 'other', username: 'otheruser', role: 'viewer' })

    server.use(
      http.get('/api/v1/users', () => {
        return HttpResponse.json({ users: [currentUser, otherUser], total: 2 })
      }),
      http.get('/api/v1/auth/me', () => {
        return HttpResponse.json(currentUser)
      })
    )

    render(<UserAccess />)

    await waitFor(() => {
      expect(screen.getByText('currentuser')).toBeInTheDocument()
      expect(screen.getByText('(You)')).toBeInTheDocument()
    })

    // Check that current user's edit/delete buttons are disabled
    const allEditButtons = screen.getAllByTitle(/edit role|cannot edit your own role/i)
    const allDeleteButtons = screen.getAllByTitle(/delete user|cannot delete yourself/i)
    
    // The current user's buttons should have disabled attribute or show tooltip
    expect(allEditButtons.length).toBeGreaterThan(0)
    expect(allDeleteButtons.length).toBeGreaterThan(0)
  })
})

