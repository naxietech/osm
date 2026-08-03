import { type ReactNode, useEffect, useRef } from 'react';

import { Check, X } from '@/design-system/atoms/icon';
import { cn } from '@/lib/utils';

export type AlertTone = 'success' | 'danger';

export interface AlertProps {
  /** Which semantic tone to render. */
  tone?: AlertTone;
  children: ReactNode;
  /** Show the leading icon badge. Defaults to true for success, false for danger. */
  withIcon?: boolean;
  /** Supply to make the banner dismissible — renders a close button that calls this. */
  onDismiss?: () => void;
  /**
   * Dismiss on its own after this many milliseconds. Requires `onDismiss`, since clearing the
   * message is the caller's state to change.
   *
   * Use for confirmations, not for failures: an error is often the only explanation a user has
   * for why something did not work, and taking it away on a timer punishes anyone who looked
   * away, reads slowly, or is still hearing it announced. `danger` alerts therefore ignore this
   * — see the guard below.
   */
  autoDismissMs?: number;
  className?: string;
}

const TONE_CLASSES: Record<AlertTone, string> = {
  success: 'border-success/30 bg-success-subtle text-success-foreground',
  danger: 'border-danger/30 bg-danger-subtle text-danger-foreground',
};

const DISMISS_CLASSES: Record<AlertTone, string> = {
  success: 'hover:bg-success/15 focus-visible:outline-success',
  danger: 'hover:bg-danger/15 focus-visible:outline-danger',
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
  autoDismissMs,
  className,
}: AlertProps): React.ReactElement {
  /**
   * Failures never dismiss themselves, whatever the caller passed. Enforced here rather than
   * left to each call site: this is the kind of rule that holds everywhere until the one screen
   * that forgets it, and by then the message it dropped is the one someone needed.
   */
  const autoDismiss = tone === 'danger' ? undefined : autoDismissMs;

  /**
   * Held in a ref so the countdown does not depend on `onDismiss` keeping its identity. Callers
   * pass an inline arrow, which is a new function every render — as a dependency it would clear
   * and restart the timer on every unrelated re-render (typing in a search box, say), so the
   * banner would sit there forever and never actually dismiss.
   */
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (autoDismiss === undefined) return undefined;
    const timer = setTimeout(() => onDismissRef.current?.(), autoDismiss);
    return () => clearTimeout(timer);
    // Only the delay restarts the countdown. To restart it for a NEW message, give the Alert a
    // `key` tied to that message so it remounts — otherwise the second message would inherit
    // whatever was left of the first one's timer.
  }, [autoDismiss]);

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
          // Named rather than left as a bare icon: "Close" alone does not say what is closing,
          // which matters when a screen has more than one thing that could be.
          aria-label="Dismiss message"
          className={cn(
            '-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors',
            DISMISS_CLASSES[tone],
          )}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

export default Alert;
