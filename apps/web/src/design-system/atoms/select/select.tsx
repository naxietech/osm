import { type SelectHTMLAttributes, forwardRef } from 'react';

import { ChevronDown } from '@/design-system/atoms/icon';
import { cn } from '@/lib/utils';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Visually marks the control as invalid and sets aria-invalid. */
  error?: boolean;
}

/**
 * Native <select> styled to match the Input atom. Uses `appearance-none` plus a
 * custom chevron so it looks consistent across browsers. Reserve right padding
 * for the chevron. Wrap in SelectField for a label + error message.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { error = false, className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={error || undefined}
        className={cn(
          'block h-[60px] w-full appearance-none rounded-md border bg-card px-3 pr-10 text-base font-normal text-foreground shadow-sm',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0',
          'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
          error
            ? 'border-danger bg-danger-subtle focus-visible:border-danger focus-visible:ring-danger'
            : 'border-input focus-visible:border-ring focus-visible:ring-ring',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
});

export default Select;
