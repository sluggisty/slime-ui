import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../test/test-utils';
import { Table, Badge } from './Table';

interface TestItem {
  id: string;
  name: string;
  status: string;
  count: number;
}

describe('Table', () => {
  const mockData: TestItem[] = [
    { id: '1', name: 'Item 1', status: 'active', count: 10 },
    { id: '2', name: 'Item 2', status: 'inactive', count: 20 },
  ];

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status' },
    { key: 'count', header: 'Count' },
  ];

  it('renders table with data', () => {
    render(<Table columns={columns} data={mockData} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Count')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('renders empty message when data is empty', () => {
    render(<Table columns={columns} data={[]} />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByText('Name')).not.toBeInTheDocument();
  });

  it('renders custom empty message', () => {
    render(<Table columns={columns} data={[]} emptyMessage='No items found' />);

    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<Table columns={columns} data={mockData} loading={true} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
  });

  it('calls onRowClick when row is clicked', () => {
    const handleRowClick = vi.fn();
    render(<Table columns={columns} data={mockData} onRowClick={handleRowClick} />);

    // Find and click the first data row
    const firstRow = screen.getByText('Item 1').closest('tr');
    if (firstRow) {
      firstRow.click();
      expect(handleRowClick).toHaveBeenCalledWith(mockData[0]);
    }
  });

  it('does not call onRowClick when not provided', () => {
    render(<Table columns={columns} data={mockData} />);

    const firstRow = screen.getByText('Item 1').closest('tr');
    // Should not throw when clicking without onRowClick handler
    expect(() => firstRow?.click()).not.toThrow();
  });

  it('uses custom render function for cells', () => {
    const columnsWithRender = [
      { key: 'name', header: 'Name' },
      {
        key: 'status',
        header: 'Status',
        render: (item: TestItem) => <Badge variant='success'>{item.status}</Badge>,
      },
    ];

    render(<Table columns={columnsWithRender} data={mockData} />);

    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('inactive')).toBeInTheDocument();
  });

  it('renders default value when field is missing', () => {
    const dataWithMissing = [{ id: '1', name: 'Item 1' } as TestItem];

    render(<Table columns={columns} data={dataWithMissing} />);

    // Should render '-' for missing fields
    const cells = screen.getAllByText('-');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('applies column width when specified', () => {
    const columnsWithWidth = [
      { key: 'name', header: 'Name', width: '200px' },
      { key: 'status', header: 'Status' },
    ];

    const { container } = render(<Table columns={columnsWithWidth} data={mockData} />);

    const headerCell = container.querySelector('th[style*="200px"]');
    expect(headerCell).toBeInTheDocument();
  });
});

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText('Test Badge')).toBeInTheDocument();
  });

  it('applies default variant class', () => {
    const { container } = render(<Badge>Default</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('badge');
  });

  it('applies success variant class', () => {
    const { container } = render(<Badge variant='success'>Success</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('success');
  });

  it('applies warning variant class', () => {
    const { container } = render(<Badge variant='warning'>Warning</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('warning');
  });

  it('applies error variant class', () => {
    const { container } = render(<Badge variant='error'>Error</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('error');
  });

  it('applies info variant class', () => {
    const { container } = render(<Badge variant='info'>Info</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('info');
  });
});
