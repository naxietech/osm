import React from 'react';

export interface CountCellProps {
  value: number;
  /** `warning` tints a non-zero count amber — for things like flagged scripts. */
  tone?: 'warning';
}

/**
 * A numeric table cell that shows an em-dash for zero and the number otherwise, so a
 * table of counts reads at a glance without a column of noisy zeros. Presentational.
 */
export function CountCell({ value, tone }: CountCellProps): React.ReactElement {
  if (value === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={tone === 'warning' ? 'tabular-nums text-warning-foreground' : 'tabular-nums'}>
      {value}
    </span>
  );
}

export default CountCell;
