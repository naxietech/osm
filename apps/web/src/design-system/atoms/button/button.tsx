import { type ButtonHTMLAttributes, forwardRef } from 'react';

import { cn } from '@/lib/utils';

import { Spinner } from '../spinner';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  /** `field` matches the Input/FormField height, for buttons placed inline with one. */
  size?: 'sm' | 'md' | 'lg' | 'field';
  isLoading?: boolean;
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-brand-gradient text-brand-foreground hover:brightness-95',
  secondary: 'border border-brand bg-transparent text-brand hover:bg-brand-subtle',
  danger: 'bg-danger text-white hover:opacity-90',
  ghost: 'bg-transparent text-foreground hover:bg-muted',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-9 px-3 text-xs',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  // Matches the Input atom's height exactly, so a button sitting beside a form field
  // lines up with it instead of floating 16px short.
  field: 'h-[60px] px-4 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled = false,
    type = 'button',
    className,
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        variantClasses[variant],
        sizeClasses[size],
        isDisabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      {...rest}
    >
      {isLoading && <Spinner size="sm" />}
      {children}
    </button>
  );
});

export default Button;
