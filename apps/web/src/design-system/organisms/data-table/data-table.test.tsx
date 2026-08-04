import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    /** Only School A has anything to show; School B returns null. */
    const renderExpanded = (row: TestRow): React.ReactNode =>
      row.id === '1' ? <p>Detail for {row.name}</p> : null;

    const rowFor = (name: string): HTMLElement => {
      const row = screen.getByText(name).closest('tr');
      if (!row) throw new Error(`no row for ${name}`);
      return row;
    };

    it('shows the panel only for rows listed in expandedIds', () => {
      render(
        <DataTable
          data={data}
          columns={columns}
          renderExpanded={renderExpanded}
          expandedIds={new Set(['1'])}
          onToggleExpand={vi.fn()}
        />,
      );

      expect(screen.getByText('Detail for School A')).toBeInTheDocument();
      expect(rowFor('School A')).toHaveAttribute('aria-expanded', 'true');
    });

    it('keeps a collapsed row closed and marks it so', () => {
      render(
        <DataTable
          data={data}
          columns={columns}
          renderExpanded={renderExpanded}
          expandedIds={new Set()}
          onToggleExpand={vi.fn()}
        />,
      );

      expect(screen.queryByText('Detail for School A')).not.toBeInTheDocument();
      expect(rowFor('School A')).toHaveAttribute('aria-expanded', 'false');
    });

    it('reports a toggle when an expandable row is activated', () => {
      const onToggleExpand = vi.fn();
      render(
        <DataTable
          data={data}
          columns={columns}
          renderExpanded={renderExpanded}
          expandedIds={new Set()}
          onToggleExpand={onToggleExpand}
        />,
      );

      fireEvent.click(screen.getByText('School A'));

      expect(onToggleExpand).toHaveBeenCalledWith(data[0]);
    });

    it('falls back to onRowClick for a row that has no panel', () => {
      const onToggleExpand = vi.fn();
      const onRowClick = vi.fn();
      render(
        <DataTable
          data={data}
          columns={columns}
          renderExpanded={renderExpanded}
          expandedIds={new Set()}
          onToggleExpand={onToggleExpand}
          onRowClick={onRowClick}
        />,
      );

      const row = rowFor('School B');
      expect(row).not.toHaveAttribute('aria-expanded');

      fireEvent.click(screen.getByText('School B'));

      // Nothing to reveal, so no toggle — but it still does whatever a plain row does, which
      // keeps every existing caller of onRowClick working when a panel is added later.
      // A page that wants such rows completely inert simply omits onRowClick, as Classes does.
      expect(onToggleExpand).not.toHaveBeenCalled();
      expect(onRowClick).toHaveBeenCalledWith(data[1]);
    });

    it('expansion wins over onRowClick, so one click never does two things', () => {
      const onToggleExpand = vi.fn();
      const onRowClick = vi.fn();
      render(
        <DataTable
          data={data}
          columns={columns}
          renderExpanded={renderExpanded}
          expandedIds={new Set()}
          onToggleExpand={onToggleExpand}
          onRowClick={onRowClick}
        />,
      );

      fireEvent.click(screen.getByText('School A'));

      expect(onToggleExpand).toHaveBeenCalledWith(data[0]);
      expect(onRowClick).not.toHaveBeenCalled();
    });

    it('opens on Enter, so the tree is reachable without a mouse', () => {
      const onToggleExpand = vi.fn();
      render(
        <DataTable
          data={data}
          columns={columns}
          renderExpanded={renderExpanded}
          expandedIds={new Set()}
          onToggleExpand={onToggleExpand}
        />,
      );

      fireEvent.keyDown(rowFor('School A'), { key: 'Enter' });

      expect(onToggleExpand).toHaveBeenCalledWith(data[0]);
    });

    it('ignores a keypress that came from a control inside the row', async () => {
      const onToggleExpand = vi.fn();
      const onButtonClick = vi.fn();
      const withButton: ColumnDef<TestRow>[] = [
        ...columns,
        {
          key: 'actions',
          header: 'Actions',
          render: () => (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onButtonClick();
              }}
            >
              Act
            </button>
          ),
        },
      ];

      render(
        <DataTable
          data={data}
          columns={withButton}
          renderExpanded={renderExpanded}
          expandedIds={new Set()}
          onToggleExpand={onToggleExpand}
        />,
      );

      const act = within(rowFor('School A')).getByRole('button', { name: 'Act' });
      act.focus();
      await userEvent.keyboard('{Enter}');

      // The keydown bubbles to the row, and stopPropagation on the button's onClick does not
      // stop it. Without the target guard the row would preventDefault the very keypress the
      // browser turns into this button's click — the row would toggle and the button would
      // never fire.
      expect(onButtonClick).toHaveBeenCalledTimes(1);
      expect(onToggleExpand).not.toHaveBeenCalled();
    });

    it('points aria-controls at the panel it opened', () => {
      render(
        <DataTable
          data={data}
          columns={columns}
          renderExpanded={renderExpanded}
          expandedIds={new Set(['1'])}
          onToggleExpand={vi.fn()}
        />,
      );

      const panelId = rowFor('School A').getAttribute('aria-controls');
      expect(panelId).toBeTruthy();
      expect(document.getElementById(panelId as string)).toHaveTextContent('Detail for School A');
    });

    it('spans the panel across every column, chevron column included', () => {
      render(
        <DataTable
          data={data}
          columns={columns}
          renderExpanded={renderExpanded}
          expandedIds={new Set(['1'])}
          onToggleExpand={vi.fn()}
        />,
      );

      const panelCell = screen.getByText('Detail for School A').closest('td');
      expect(panelCell).toHaveAttribute('colspan', '3');
    });
  });
});
