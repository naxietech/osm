import React, { useState } from 'react';

import { ChevronDown, ChevronRight } from '@/design-system/atoms/icon';
import { Spinner } from '@/design-system/atoms/spinner';
import { cn } from '@/lib/utils';

export interface ColumnDef<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  width?: string;
}

export interface DataTableProps<T extends { id: string }> {
  data: T[];
  columns: ColumnDef<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  className?: string;
  /**
   * Detail shown in a full-width row beneath its parent, opened by a chevron in a leading
   * column. Return `null` for a row with nothing to show and it gets no chevron — a control
   * that opens an empty drawer is worse than no control.
   *
   * Expansion state lives here rather than in the page: it is presentation, it resets with the
   * table, and every caller would otherwise re-implement the same `Set` of open ids.
   */
  renderExpanded?: (row: T) => React.ReactNode;
  /** Accessible name for the chevron, completed with the row: "Show questions for Schools". */
  expandLabel?: (row: T) => string;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  isLoading = false,
  emptyMessage = 'No data found',
  onRowClick,
  className,
  renderExpanded,
  expandLabel,
}: DataTableProps<T>): React.ReactElement {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  const toggle = (id: string): void =>
    setExpanded((open) => {
      const next = new Set(open);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, row: T): void => {
    if (!onRowClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick(row);
    }
  };

  const columnCount = columns.length + (renderExpanded ? 1 : 0);

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted">
          <tr>
            {renderExpanded && (
              <th scope="col" style={{ width: '48px' }} className="border-b border-border">
                <span className="sr-only">Expand</span>
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={col.width ? { width: col.width } : undefined}
                className="border-b border-border px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columnCount}
                className="px-4 py-8 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => {
              const detail = renderExpanded?.(row) ?? null;
              const isOpen = expanded.has(row.id);

              return (
                <React.Fragment key={row.id}>
                  <tr
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={onRowClick ? (e) => handleRowKeyDown(e, row) : undefined}
                    role={onRowClick ? 'button' : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    className={cn(
                      'transition-colors hover:bg-muted',
                      onRowClick &&
                        'cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring',
                    )}
                  >
                    {renderExpanded && (
                      <td className="px-2 py-3 align-middle">
                        {detail !== null && (
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-label={expandLabel?.(row) ?? 'Show details'}
                            // The row may itself be clickable; opening the drawer must not also
                            // navigate away from the table the drawer belongs to.
                            onClick={(e) => {
                              e.stopPropagation();
                              toggle(row.id);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" aria-hidden />
                            ) : (
                              <ChevronRight className="h-4 w-4" aria-hidden />
                            )}
                          </button>
                        )}
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-sm text-foreground">
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>

                  {isOpen && detail !== null && (
                    <tr className="bg-muted/30">
                      <td colSpan={columnCount} className="px-4 py-4">
                        {detail}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
