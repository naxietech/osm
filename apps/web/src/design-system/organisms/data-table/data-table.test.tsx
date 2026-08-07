import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type ColumnDef, DataTable } from './data-table';

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

  describe('expandable rows', () => {
    const renderExpanded = (row: TestRow): React.ReactNode => <p>Detail for {row.name}</p>;

    it('hides the detail until its own chevron is pressed', () => {
      render(<DataTable data={data} columns={columns} renderExpanded={renderExpanded} />);

      expect(screen.queryByText('Detail for School A')).not.toBeInTheDocument();
      fireEvent.click(screen.getAllByRole('button', { name: 'Show details' })[0]!);
      expect(screen.getByText('Detail for School A')).toBeInTheDocument();
      // One chevron opens one row — not every row that happens to be expandable.
      expect(screen.queryByText('Detail for School B')).not.toBeInTheDocument();
    });

    it('closes again on a second press', () => {
      render(<DataTable data={data} columns={columns} renderExpanded={renderExpanded} />);
      const chevron = screen.getAllByRole('button', { name: 'Show details' })[0]!;

      fireEvent.click(chevron);
      fireEvent.click(chevron);
      expect(screen.queryByText('Detail for School A')).not.toBeInTheDocument();
    });

    it('gives no chevron to a row with nothing to show', () => {
      // A control that opens an empty drawer is worse than no control.
      render(
        <DataTable
          data={data}
          columns={columns}
          renderExpanded={(row) => (row.id === '1' ? <p>Detail for {row.name}</p> : null)}
        />,
      );

      expect(screen.getAllByRole('button', { name: 'Show details' })).toHaveLength(1);
    });

    it('names the chevron after its row', () => {
      render(
        <DataTable
          data={data}
          columns={columns}
          renderExpanded={renderExpanded}
          expandLabel={(row) => `Show questions for ${row.name}`}
        />,
      );

      expect(screen.getByRole('button', { name: 'Show questions for School A' })).toBeVisible();
    });

    it('does not fire onRowClick when the chevron is pressed', () => {
      // The drawer belongs to the table; opening it must not navigate away from the table.
      const handleRowClick = vi.fn();
      render(
        <DataTable
          data={data}
          columns={columns}
          onRowClick={handleRowClick}
          renderExpanded={renderExpanded}
        />,
      );

      fireEvent.click(screen.getAllByRole('button', { name: 'Show details' })[0]!);
      expect(handleRowClick).not.toHaveBeenCalled();
      expect(screen.getByText('Detail for School A')).toBeInTheDocument();
    });

    it('spans the empty message across the extra chevron column', () => {
      render(<DataTable data={[]} columns={columns} renderExpanded={renderExpanded} />);

      expect(screen.getByText('No data found')).toHaveAttribute('colspan', '3');
    });
  });
});
