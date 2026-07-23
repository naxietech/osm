import { type ReactElement } from 'react';

import { cn } from '@/lib/utils';

export interface ProgressBarProps {
  /** Completed portion as a percentage. Values outside 0–100 are clamped. */
  value: number;
  /**
   * Accessible name for the bar, e.g. "Physics · Page 3 marking progress". Required:
   * a bare bar tells a screen-reader user a number with nothing to attach it to.
   */
  label: string;
  /** Render the percentage as text beside the bar. */
  showValue?: boolean;
  className?: string;
}

/**
 * A single completed-out-of-total bar.
 *
 * Presentational and domain-free — callers pass an already-computed percentage, so the
 * same bar serves marking progress, exam registration and onboarding without learning
 * anything about them.
 */
export function ProgressBar({
  value,
  label,
  showValue = false,
  className,
}: ProgressBarProps): ReactElement {
  // Guard the width against bad input: a NaN or 140% would otherwise paint outside the track.
  const safe = Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300"
          style={{ width: `${safe}%` }}
        />
      </div>
      {showValue && (
        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {safe}%
        </span>
      )}
    </div>
  );
}

export default ProgressBar;
