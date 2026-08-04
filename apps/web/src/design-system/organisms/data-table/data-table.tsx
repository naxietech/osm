import React from 'react';

import { ChevronRight } from '@/design-system/atoms/icon';
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
   * Detail panel for a row, shown beneath it while expanded. Return `null` for a row with
   * nothing to show — it gets no chevron and cannot be expanded, so an empty panel is never
   * something a user can open. (Such a row still honours `onRowClick`; see below.)
   *
   * Providing this adds a narrow leading column for the disclosure chevron.
   */
  renderExpanded?: (row: T) => React.ReactNode;
  /** Which rows are open. Controlled by the caller, like every other bit of state here. */
  expandedIds?: ReadonlySet<string>;
  /** A row's disclosure was activated. Pair with {@link expandedIds} to open or close it. */
  onToggleExpand?: (row: T) => void;
}

/**
 * Table with optional per-row detail panels.
 *
 * **A row does one thing on click.** When it can expand, clicking it expands it and
 * `onRowClick` is not called — two different actions on one click target is how people end up
 * opening an editor they meant to peek into. A page that wants both gives the second action
 * its own button in a cell.
 *
 * A row whose panel is `null` has nothing to expand, so it falls back to `onRowClick` like any
 * ordinary row — which is what keeps existing callers working when a panel is added to a table
 * later. Omit `onRowClick` (as the Classes screen does) to leave those rows completely inert.
 */
export function DataTable<T extends { id: string }>({
  data,
  columns,
  isLoading = false,
  emptyMessage = 'No data found',
  onRowClick,
  className,
  renderExpanded,
  expandedIds,
  onToggleExpand,
}: DataTableProps<T>): React.ReactElement {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const isExpandable = Boolean(renderExpanded);
  /** The chevron occupies a real column, so the header and the empty state have to count it. */
  const columnCount = columns.length + (isExpandable ? 1 : 0);

  /** What activating this row does, or nothing if it does nothing. Expansion wins. */
  const activate = (row: T, canExpand: boolean): (() => void) | undefined => {
    if (canExpand) return () => onToggleExpand?.(row);
    if (onRowClick) return () => onRowClick(row);
    return undefined;
  };

  const handleRowKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
    onActivate: (() => void) | undefined,
  ): void => {
    if (!onActivate) return;
    // Only when the row itself has focus. A row can hold its own buttons (Edit, Deactivate),
    // and their keydown bubbles up here — `stopPropagation` on their onClick does nothing for
    // it. Without this guard, Enter on such a button would `preventDefault()` the keypress the
    // browser was about to turn into that button's click: the row would toggle and the button
    // would never fire. Mouse clicks were fine, which is exactly why it went unnoticed.
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivate();
    }
  };

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted">
          <tr>
            {isExpandable && (
              <th
                scope="col"
                style={{ width: '44px' }}
                className="border-b border-border px-2 py-3"
              />
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
              const panel = renderExpanded ? renderExpanded(row) : null;
              const canExpand = panel !== null && panel !== undefined && panel !== false;
              const isExpanded = canExpand && Boolean(expandedIds?.has(row.id));
              const onActivate = activate(row, canExpand);
              /** Names the panel so the row's `aria-controls` can point at it. */
              const panelId = `${row.id}-panel`;

              return (
                <React.Fragment key={row.id}>
                  <tr
                    onClick={onActivate}
                    onKeyDown={(e) => handleRowKeyDown(e, onActivate)}
                    role={onActivate ? 'button' : undefined}
                    tabIndex={onActivate ? 0 : undefined}
                    aria-expanded={canExpand ? isExpanded : undefined}
                    aria-controls={isExpanded ? panelId : undefined}
                    className={cn(
                      'transition-colors hover:bg-muted',
                      onActivate &&
                        'cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring',
                    )}
                  >
                    {isExpandable && (
                      <td className="px-2 py-3 align-middle">
                        {canExpand && (
                          <ChevronRight
                            className={cn(
                              'h-4 w-4 text-muted-foreground transition-transform',
                              isExpanded && 'rotate-90',
                            )}
                            aria-hidden
                          />
                        )}
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-sm text-foreground">
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && (
                    <tr className="bg-muted/40">
                      <td id={panelId} colSpan={columnCount} className="px-4 py-3">
                        {panel}
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
