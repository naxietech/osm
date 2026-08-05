import { type ReactNode } from 'react';

import { Check, X } from '@/design-system/atoms/icon';
import { cn } from '@/lib/utils';

export type AlertTone = 'success' | 'danger' | 'warning';

export interface AlertProps {
  /** Which semantic tone to render. */
  tone?: AlertTone;
  children: ReactNode;
  /** Show the leading icon badge. Defaults to true for success, false for danger. */
  withIcon?: boolean;
  /**
   * Makes the banner dismissible: pass a handler that clears whatever state renders it.
   * Omit it for a banner the user should not be able to hide — a validation failure that
   * still blocks the form, say, where dismissing would leave them stuck with no explanation.
   */
  onDismiss?: () => void;
  /** Accessible name for the dismiss button. */
  dismissLabel?: string;
  className?: string;
}

const TONE_CLASSES: Record<AlertTone, string> = {
  success: 'border-success/30 bg-success-subtle text-success-foreground',
  danger: 'border-danger/30 bg-danger-subtle text-danger-foreground',
  warning: 'border-warning/30 bg-warning-subtle text-warning-foreground',
};

/**
 * Inline confirmation / error banner.
 *
 * Extracted after the same success-banner markup was found hand-written in eight pages
 * (one of which had already drifted by dropping the icon). `success` announces politely
 * via `role="status"`; `danger` interrupts via `role="alert"`.
 */
export function Alert({
  tone = 'success',
  children,
  withIcon = tone === 'success',
  onDismiss,
  dismissLabel = 'Dismiss message',
  className,
}: AlertProps): React.ReactElement {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {withIcon && (
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white',
            tone === 'success' ? 'bg-success' : 'bg-danger',
          )}
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">{children}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          // Inherits the banner's colour rather than picking its own, so one control works
          // on all three tones without a per-tone class map.
          className="-mr-1 shrink-0 rounded-md p-1 text-current opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

export default Alert;
