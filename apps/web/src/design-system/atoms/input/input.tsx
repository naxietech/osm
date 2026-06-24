import { type InputHTMLAttributes, forwardRef } from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Visually marks the field as invalid and sets aria-invalid. */
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { type = 'text', error = false, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={error || undefined}
      className={cn(
        'block h-[60px] w-full rounded-md border bg-card px-3 py-2 text-base font-normal text-foreground shadow-sm',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
        error
          ? 'border-danger bg-danger-subtle focus-visible:border-danger focus-visible:ring-danger'
          : 'border-input focus-visible:border-ring focus-visible:ring-ring',
        className,
      )}
      {...rest}
    />
  );
});

export default Input;
