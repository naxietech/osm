import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DataTable, type ColumnDef } from './data-table';

interface TestRow {
  id: string;
  name: string;
  city: string;
}

const columns: ColumnDef<TestRow>[] = [
  { key: 'name', header: 'Name', render: (row) => row.name },
  { key: 'city', header: 'City', render: (row) => row.city },
];

const data: TestRow[] = [
  { id: '1', name: 'School A', city: 'Lahore' },
  { id: '2', name: 'School B', city: 'Karachi' },
];

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable data={data} columns={columns} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('City')).toBeInTheDocument();
  });

  it('renders rows for each data item', () => {
    render(<DataTable data={data} columns={columns} />);
    expect(screen.getByText('School A')).toBeInTheDocument();
    expect(screen.getByText('School B')).toBeInTheDocument();
    expect(screen.getByText('Lahore')).toBeInTheDocument();
  });

  it('shows emptyMessage when data is empty array', () => {
    render(<DataTable data={[]} columns={columns} emptyMessage="No schools found" />);
    expect(screen.getByText('No schools found')).toBeInTheDocument();
  });

  it('shows spinner when isLoading is true', () => {
    render(<DataTable data={[]} columns={columns} isLoading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('calls onRowClick with correct row when a row is clicked', () => {
    const handleRowClick = vi.fn();
    render(<DataTable data={data} columns={columns} onRowClick={handleRowClick} />);
    fireEvent.click(screen.getByText('School A'));
    expect(handleRowClick).toHaveBeenCalledWith(data[0]);
  });
});
