import { type ReactNode } from 'react';

import { Check } from '@/design-system/atoms/icon';
import { cn } from '@/lib/utils';

export type AlertTone = 'success' | 'danger';

export interface AlertProps {
  /** Which semantic tone to render. */
  tone?: AlertTone;
  children: ReactNode;
  /** Show the leading icon badge. Defaults to true for success, false for danger. */
  withIcon?: boolean;
  className?: string;
}

const TONE_CLASSES: Record<AlertTone, string> = {
  success: 'border-success/30 bg-success-subtle text-success-foreground',
  danger: 'border-danger/30 bg-danger-subtle text-danger-foreground',
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
      {children}
    </div>
  );
}

export default Alert;
