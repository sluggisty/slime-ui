import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/test-utils';
import HostDetail from './HostDetail';
import { createMockReport } from '../test/mockData';
import { server } from '../test/server';
import { http, HttpResponse } from 'msw';

// Mock useParams and useNavigate
const mockParams = { host_id: 'test-host-id-1' };
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => mockParams,
    useNavigate: () => mockNavigate,
  };
});

describe('HostDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('renders loading state while fetching host data', () => {
    server.use(
      http.get('/api/v1/hosts/:id', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return HttpResponse.json(createMockReport({ meta: { host_id: mockParams.host_id } }));
      })
    );

    render(<HostDetail />);
    expect(screen.getByText(/loading host data/i)).toBeInTheDocument();
  });

  it('renders host detail with hostname', async () => {
    const report = createMockReport({
      meta: {
        host_id: mockParams.host_id,
        hostname: 'test-hostname',
      },
    });

    server.use(
      http.get('/api/v1/hosts/:id', () => {
        return HttpResponse.json(report);
      })
    );

    render(<HostDetail />);

    await waitFor(() => {
      expect(screen.getByText('test-hostname')).toBeInTheDocument();
    });
  });

  it('renders error state when host not found', async () => {
    server.use(
      http.get('/api/v1/hosts/:id', () => {
        return HttpResponse.json({ error: 'Not found' }, { status: 404 });
      })
    );

    render(<HostDetail />);

    await waitFor(() => {
      expect(screen.getByText(/host not found/i)).toBeInTheDocument();
    });
  });

  it('renders system information section', async () => {
    const report = createMockReport({
      meta: { host_id: mockParams.host_id },
      data: {
        system: {
          os: { name: 'Fedora', version: '42' },
          kernel: { release: '6.0.0' },
        },
      },
    });

    server.use(
      http.get('/api/v1/hosts/:id', () => {
        return HttpResponse.json(report);
      })
    );

    render(<HostDetail />);

    await waitFor(() => {
      expect(screen.getByText('System')).toBeInTheDocument();
    });
  });

  it('renders hardware information section', async () => {
    const report = createMockReport({
      meta: { host_id: mockParams.host_id },
      data: {
        hardware: {
          cpu: { model: 'Intel Core i7', physical_cores: 8 },
          memory: { total_human: '16 GB' },
        },
      },
    });

    server.use(
      http.get('/api/v1/hosts/:id', () => {
        return HttpResponse.json(report);
      })
    );

    render(<HostDetail />);

    await waitFor(() => {
      expect(screen.getByText('Hardware')).toBeInTheDocument();
    });
  });

  it('opens delete modal when delete button is clicked', async () => {
    const report = createMockReport({
      meta: { host_id: mockParams.host_id, hostname: 'test-host' },
    });

    server.use(
      http.get('/api/v1/hosts/:id', () => {
        return HttpResponse.json(report);
      })
    );

    const user = userEvent.setup();
    render(<HostDetail />);

    await waitFor(() => {
      expect(screen.getByText('test-host')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText(/delete/i).closest('button');
    if (deleteButton) {
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText(/delete host/i)).toBeInTheDocument();
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      });
    }
  });

  it('navigates back to hosts when back button is clicked', async () => {
    const report = createMockReport({
      meta: { host_id: mockParams.host_id },
    });

    server.use(
      http.get('/api/v1/hosts/:id', () => {
        return HttpResponse.json(report);
      })
    );

    const user = userEvent.setup();
    render(<HostDetail />);

    await waitFor(() => {
      expect(screen.getByText(/back to hosts/i)).toBeInTheDocument();
    });

    const backButton = screen.getByText(/back to hosts/i).closest('button');
    if (backButton) {
      await user.click(backButton);
      expect(mockNavigate).toHaveBeenCalledWith('/hosts');
    }
  });

  it('renders collapsible sections', async () => {
    const report = createMockReport({
      meta: { host_id: mockParams.host_id },
      data: {
        system: { os: { name: 'Fedora' } },
        hardware: { cpu: { model: 'Intel' } },
      },
    });

    server.use(
      http.get('/api/v1/hosts/:id', () => {
        return HttpResponse.json(report);
      })
    );

    render(<HostDetail />);

    await waitFor(() => {
      expect(screen.getByText('System')).toBeInTheDocument();
      expect(screen.getByText('Hardware')).toBeInTheDocument();
    });
  });
});
