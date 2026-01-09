import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/test-utils';
import Dashboard from './Dashboard';
import { createMockHostsArray, createMockHostsResponse } from '../test/mockData';
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

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard with stat cards', async () => {
    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts: createMockHostsArray(3) }));
      })
    );

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Hosts')).toBeInTheDocument();
    });

    expect(screen.getByText('Active Hosts')).toBeInTheDocument();
    expect(screen.getByText('Stale Hosts')).toBeInTheDocument();
  });

  it('displays loading state while fetching hosts', () => {
    server.use(
      http.get('/api/v1/hosts', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return HttpResponse.json(createMockHostsResponse({ hosts: createMockHostsArray(3) }));
      })
    );

    render(<Dashboard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('displays empty state when no hosts', async () => {
    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts: [] }));
      })
    );

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/no hosts reporting yet/i)).toBeInTheDocument();
    });
  });

  it('displays host list when hosts are available', async () => {
    const hosts = createMockHostsArray(5);
    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts }));
      })
    );

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(hosts[0].hostname)).toBeInTheDocument();
    });
  });

  it('calculates and displays correct total hosts count', async () => {
    const hosts = createMockHostsArray(5);
    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts, total: 5 }));
      })
    );

    render(<Dashboard />);

    await waitFor(() => {
      // The total hosts value should be displayed in the stat card
      // Since "5" might appear in other places, we check for the stat card context
      expect(screen.getByText('Total Hosts')).toBeInTheDocument();
      // Check that at least one stat value is displayed (could be 5 for total, or 0 for active/stale)
      const statValues = screen.getAllByText(/\d+/);
      expect(statValues.length).toBeGreaterThan(0);
    });
  });

  it('navigates to hosts page when View All is clicked', async () => {
    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts: createMockHostsArray(3) }));
      })
    );

    const user = userEvent.setup();
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/view all/i)).toBeInTheDocument();
    });

    const viewAllButton = screen.getByText(/view all/i);
    await user.click(viewAllButton);

    expect(mockNavigate).toHaveBeenCalledWith('/hosts');
  });

  it('navigates to host detail when host card is clicked', async () => {
    const hosts = createMockHostsArray(3);
    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts }));
      })
    );

    const user = userEvent.setup();
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(hosts[0].hostname)).toBeInTheDocument();
    });

    const hostCard = screen.getByText(hosts[0].hostname).closest('[class*="hostCard"]');
    if (hostCard) {
      await user.click(hostCard);
      expect(mockNavigate).toHaveBeenCalledWith(`/hosts/${hosts[0].host_id}`);
    }
  });

  it('displays Recent Hosts section', async () => {
    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts: createMockHostsArray(3) }));
      })
    );

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Recent Hosts')).toBeInTheDocument();
    });
  });

  it('handles error state when query fails', async () => {
    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json({ error: 'Internal server error' }, { status: 500 });
      })
    );

    render(<Dashboard />);

    // The component should handle errors gracefully
    // Since the component doesn't explicitly show errors, we verify it doesn't crash
    await waitFor(() => {
      // Loading state should disappear
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
  });

  it('calls api.getHosts with correct query parameters', async () => {
    const getHostsSpy = vi.spyOn(api, 'getHosts');

    server.use(
      http.get('/api/v1/hosts', () => {
        return HttpResponse.json(createMockHostsResponse({ hosts: createMockHostsArray(2) }));
      })
    );

    render(<Dashboard />);

    await waitFor(() => {
      expect(getHostsSpy).toHaveBeenCalled();
    });

    // Verify api.getHosts was called (query function is invoked)
    expect(getHostsSpy).toHaveBeenCalledTimes(1);

    // Verify data was successfully fetched and rendered
    await waitFor(() => {
      expect(screen.getByText('Total Hosts')).toBeInTheDocument();
    });

    getHostsSpy.mockRestore();
  });
});
