import { type TextareaHTMLAttributes, forwardRef } from 'react';

import { cn } from '@/lib/utils';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Visually marks the field as invalid and sets aria-invalid. */
  error?: boolean;
}

/**
 * Multi-line text input — the sibling of the `Input` atom for anything longer than a line
 * (comments, reasons, notes). Presentational and domain-free.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { error = false, className, rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={error || undefined}
      className={cn(
        'block w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none',
        'placeholder:text-muted-foreground',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
        error
          ? 'border-danger bg-danger-subtle focus:ring-1 focus:ring-danger'
          : 'border-border focus:ring-1 focus:ring-ring',
        className,
      )}
      {...rest}
    />
  );
});

export default Textarea;
