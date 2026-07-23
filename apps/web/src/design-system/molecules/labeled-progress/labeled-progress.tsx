import React from 'react';

import { ProgressBar } from '@/design-system/atoms/progress-bar';

export interface LabeledProgressProps {
  /** Completed portion as a percentage (already computed). */
  percent: number;
  marked: number;
  total: number;
  /** What the bar is measuring, e.g. an exam or subject name. */
  label: string;
}

/**
 * A progress bar with a "{marked} of {total} marked" caption beneath it — the shape used
 * in the checker's My Work tables. Presentational: it composes the ProgressBar atom and
 * knows nothing about marking beyond the counts it is handed.
 */
export function LabeledProgress({
  percent,
  marked,
  total,
  label,
}: LabeledProgressProps): React.ReactElement {
  return (
    <span className="block">
      <ProgressBar value={percent} label={`${label} marking progress`} showValue />
      <span className="mt-1 block text-xs tabular-nums text-muted-foreground">
        {marked} of {total} marked
      </span>
    </span>
  );
}

export default LabeledProgress;
