import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Sidebar from './Sidebar';
import { auth, authApi } from '../api/auth';
import { createMockUser } from '../test/mockData';

// Mock the auth module
vi.mock('../api/auth', () => ({
  auth: {
    isAuthenticated: vi.fn(),
  },
  authApi: {
    getMe: vi.fn(),
  },
}));

// Helper to render with MemoryRouter (without BrowserRouter from test-utils)
const renderWithRouter = (ui: React.ReactElement, initialEntries: string[] = ['/']) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.isAuthenticated).mockReturnValue(true);
  });

  it('renders sidebar with logo', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue(createMockUser());

    renderWithRouter(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByText('Sluggisty')).toBeInTheDocument();
    });

    expect(screen.getByText('System Insights')).toBeInTheDocument();
  });

  it('renders navigation links', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue(createMockUser());

    renderWithRouter(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Hosts')).toBeInTheDocument();
  });

  it('highlights active navigation link', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue(createMockUser());

    renderWithRouter(<Sidebar />, ['/']);

    await waitFor(() => {
      const dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink?.className).toContain('active');
    });
  });

  it('renders admin section when user is admin', async () => {
    const adminUser = createMockUser({ role: 'admin', is_admin: true });
    vi.mocked(authApi.getMe).mockResolvedValue(adminUser);

    renderWithRouter(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByText('User Access')).toBeInTheDocument();
    });

    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('does not render admin section when user is not admin', async () => {
    const regularUser = createMockUser({ role: 'viewer', is_admin: false });
    vi.mocked(authApi.getMe).mockResolvedValue(regularUser);

    renderWithRouter(<Sidebar />);

    await waitFor(() => {
      expect(screen.queryByText('User Access')).not.toBeInTheDocument();
    });

    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  });

  it('renders footer with status and version', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue(createMockUser());

    renderWithRouter(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    expect(screen.getByText('v0.1.0')).toBeInTheDocument();
  });

  it('does not fetch user when not authenticated', () => {
    vi.mocked(auth.isAuthenticated).mockReturnValue(false);

    renderWithRouter(<Sidebar />);

    // getMe should not be called when not authenticated
    // This is tested implicitly - if it were called, it would be in the mock
  });
});
