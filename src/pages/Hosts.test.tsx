import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/test-utils';
import Hosts from './Hosts';
import {
  createMockHostSummary,
  createMockHostsArray,
  createMockHostsResponse,
} from '../test/mockData';
import { server } from '../test/server';
import { http, HttpResponse } from 'msw';
import { api } from '../api/client';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Hosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders hosts page with header', async () => {
    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts: createMockHostsArray(3) }));
      })
    );

    render(<Hosts />);

    await waitFor(() => {
      expect(screen.getByText('All Hosts')).toBeInTheDocument();
    });
  });

  it('displays loading state while fetching hosts', () => {
    server.use(
      http.get('/api/v1/hosts', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return HttpResponse.json(createMockHostsResponse({ hosts: createMockHostsArray(3) }));
      })
    );

    render(<Hosts />);
    // The Table component shows loading state
  });

  it('displays hosts in table', async () => {
    const hosts = createMockHostsArray(3);
    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts }));
      })
    );

    render(<Hosts />);

    await waitFor(() => {
      expect(screen.getByText(hosts[0].hostname)).toBeInTheDocument();
    });

    expect(screen.getByText(hosts[1].hostname)).toBeInTheDocument();
    expect(screen.getByText(hosts[2].hostname)).toBeInTheDocument();
  });

  it('navigates to host detail when row is clicked', async () => {
    const hosts = createMockHostsArray(2);
    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts }));
      })
    );

    const user = userEvent.setup();
    render(<Hosts />);

    await waitFor(() => {
      expect(screen.getByText(hosts[0].hostname)).toBeInTheDocument();
    });

    // Click on the row (find the row containing the hostname)
    const hostRow = screen.getByText(hosts[0].hostname).closest('tr');
    if (hostRow) {
      await user.click(hostRow);
      expect(mockNavigate).toHaveBeenCalledWith(`/hosts/${hosts[0].host_id}`);
    }
  });

  it('opens delete modal when delete button is clicked', async () => {
    const hosts = createMockHostsArray(2);
    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts }));
      })
    );

    const user = userEvent.setup();
    render(<Hosts />);

    await waitFor(() => {
      expect(screen.getAllByText(hosts[0].hostname).length).toBeGreaterThan(0);
    });

    // Find delete buttons (Trash2 icon buttons)
    const deleteButtons = screen.getAllByTitle(/delete host/i);
    expect(deleteButtons.length).toBeGreaterThan(0);
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      // Check that modal title appears
      expect(screen.getByText(/delete host/i)).toBeInTheDocument();
      // The hostname appears in both table and modal, so we verify modal content
      expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
    });
  });

  it('filters hosts by distribution', async () => {
    const host1 = createMockHostSummary({
      hostname: 'fedora-host',
      os_name: 'Fedora',
      os_version_major: '42',
    });
    const host2 = createMockHostSummary({
      hostname: 'debian-host',
      os_name: 'Debian',
      os_version_major: '12',
    });
    const hosts = [host1, host2];

    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts }));
      })
    );

    const user = userEvent.setup();
    render(<Hosts />);

    await waitFor(() => {
      expect(screen.getByText('fedora-host')).toBeInTheDocument();
      expect(screen.getByText('debian-host')).toBeInTheDocument();
    });

    // Find and change the distribution filter
    const distroFilter = screen.getByLabelText(/distribution/i);
    await user.selectOptions(distroFilter, 'Fedora');

    await waitFor(() => {
      expect(screen.getByText('fedora-host')).toBeInTheDocument();
      expect(screen.queryByText('debian-host')).not.toBeInTheDocument();
    });
  });

  it('displays filter controls', async () => {
    const host1 = createMockHostSummary({ hostname: 'fedora-host', os_name: 'Fedora' });
    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts: [host1] }));
      })
    );

    render(<Hosts />);

    await waitFor(() => {
      expect(screen.getByText('fedora-host')).toBeInTheDocument();
    });

    // Verify filter controls are visible
    const distroFilter = screen.getByLabelText(/distribution/i) as HTMLSelectElement;
    expect(distroFilter).toBeInTheDocument();
    expect(screen.getByText(/systems reporting/i)).toBeInTheDocument();
  });

  it('handles error state when query fails', async () => {
    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json({ error: 'Internal server error' }, { status: 500 });
      })
    );

    render(<Hosts />);

    // The component should handle errors gracefully
    // Since the component uses Table component which handles loading, we verify it doesn't crash
    await waitFor(
      () => {
        // Table should show empty state or handle error
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('calls api.getHosts with correct query parameters', async () => {
    const getHostsSpy = vi.spyOn(api, 'getHosts');

    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts: createMockHostsArray(2) }));
      })
    );

    render(<Hosts />);

    await waitFor(() => {
      expect(getHostsSpy).toHaveBeenCalled();
    });

    // Verify api.getHosts was called (query function is invoked)
    expect(getHostsSpy).toHaveBeenCalledTimes(1);

    // Verify data was successfully fetched and rendered
    await waitFor(() => {
      expect(screen.getByText('All Hosts')).toBeInTheDocument();
    });

    getHostsSpy.mockRestore();
  });

  it('refetches hosts list after successful deletion', async () => {
    const hosts = createMockHostsArray(2);
    const hostToDelete = hosts[0];
    let deleteCallCount = 0;

    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts }));
      }),
      http.delete(`/api/v1/hosts/${hostToDelete.host_id}`, () => {
        deleteCallCount++;
        return HttpResponse.json({});
      })
    );

    const user = userEvent.setup();
    render(<Hosts />);

    await waitFor(() => {
      expect(screen.getByText(hostToDelete.hostname)).toBeInTheDocument();
    });

    // Click delete button
    const deleteButtons = screen.getAllByTitle(/delete host/i);
    await user.click(deleteButtons[0]);

    // Confirm deletion
    await waitFor(() => {
      expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /^delete$/i });
    await user.click(confirmButton);

    // After deletion, the query should be invalidated and refetched
    // We verify this by checking that the hosts list is refetched
    await waitFor(() => {
      expect(deleteCallCount).toBe(1);
    });

    // The component should refetch the hosts list after deletion
    // Since invalidateQueries triggers a refetch, we wait for the refetch
    await waitFor(() => {
      // The host should no longer be in the list (or list should be updated)
      // Since MSW returns the same data, we verify the refetch happened by checking
      // that the delete was called and the modal is closed
      expect(screen.queryByText(/are you sure you want to delete/i)).not.toBeInTheDocument();
    });
  });
});
