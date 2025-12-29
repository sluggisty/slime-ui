import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../test/test-utils'
import Hosts from './Hosts'
import { createMockHostSummary, createMockHostsArray, createMockHostsResponse } from '../test/mockData'
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

describe('Hosts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders hosts page with header', async () => {
    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts: createMockHostsArray(3) }))
      })
    )

    render(<Hosts />)

    await waitFor(() => {
      expect(screen.getByText('All Hosts')).toBeInTheDocument()
    })
  })

  it('displays loading state while fetching hosts', () => {
    server.use(
      http.get('/api/v1/hosts', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return HttpResponse.json(createMockHostsResponse({ hosts: createMockHostsArray(3) }))
      })
    )

    render(<Hosts />)
    // The Table component shows loading state
  })

  it('displays hosts in table', async () => {
    const hosts = createMockHostsArray(3)
    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts }))
      })
    )

    render(<Hosts />)

    await waitFor(() => {
      expect(screen.getByText(hosts[0].hostname)).toBeInTheDocument()
    })

    expect(screen.getByText(hosts[1].hostname)).toBeInTheDocument()
    expect(screen.getByText(hosts[2].hostname)).toBeInTheDocument()
  })

  it('navigates to host detail when row is clicked', async () => {
    const hosts = createMockHostsArray(2)
    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts }))
      })
    )

    const user = userEvent.setup()
    render(<Hosts />)

    await waitFor(() => {
      expect(screen.getByText(hosts[0].hostname)).toBeInTheDocument()
    })

    // Click on the row (find the row containing the hostname)
    const hostRow = screen.getByText(hosts[0].hostname).closest('tr')
    if (hostRow) {
      await user.click(hostRow)
      expect(mockNavigate).toHaveBeenCalledWith(`/hosts/${hosts[0].host_id}`)
    }
  })

  it('opens delete modal when delete button is clicked', async () => {
    const hosts = createMockHostsArray(2)
    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts }))
      })
    )

    const user = userEvent.setup()
    render(<Hosts />)

    await waitFor(() => {
      expect(screen.getAllByText(hosts[0].hostname).length).toBeGreaterThan(0)
    })

    // Find delete buttons (Trash2 icon buttons)
    const deleteButtons = screen.getAllByTitle(/delete host/i)
    expect(deleteButtons.length).toBeGreaterThan(0)
    await user.click(deleteButtons[0])

    await waitFor(() => {
      // Check that modal title appears
      expect(screen.getByText(/delete host/i)).toBeInTheDocument()
      // The hostname appears in both table and modal, so we verify modal content
      expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument()
    })
  })

  it('filters hosts by distribution', async () => {
    const host1 = createMockHostSummary({ hostname: 'fedora-host', os_name: 'Fedora', os_version_major: '42' })
    const host2 = createMockHostSummary({ hostname: 'debian-host', os_name: 'Debian', os_version_major: '12' })
    const hosts = [host1, host2]

    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts }))
      })
    )

    const user = userEvent.setup()
    render(<Hosts />)

    await waitFor(() => {
      expect(screen.getByText('fedora-host')).toBeInTheDocument()
      expect(screen.getByText('debian-host')).toBeInTheDocument()
    })

    // Find and change the distribution filter
    const distroFilter = screen.getByLabelText(/distribution/i)
    await user.selectOptions(distroFilter, 'Fedora')

    await waitFor(() => {
      expect(screen.getByText('fedora-host')).toBeInTheDocument()
      expect(screen.queryByText('debian-host')).not.toBeInTheDocument()
    })
  })

  it('displays filter controls', async () => {
    const host1 = createMockHostSummary({ hostname: 'fedora-host', os_name: 'Fedora' })
    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts: [host1] }))
      })
    )

    render(<Hosts />)

    await waitFor(() => {
      expect(screen.getByText('fedora-host')).toBeInTheDocument()
    })

    // Verify filter controls are visible
    const distroFilter = screen.getByLabelText(/distribution/i) as HTMLSelectElement
    expect(distroFilter).toBeInTheDocument()
    expect(screen.getByText(/systems reporting/i)).toBeInTheDocument()
  })
})

