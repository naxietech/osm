import { type HTMLAttributes, type ReactElement } from 'react';

import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-success-subtle text-success-foreground',
  warning: 'bg-warning-subtle text-warning-foreground',
  error: 'bg-danger-subtle text-danger-foreground',
  info: 'bg-info-subtle text-info-foreground',
};

export function Badge({
  variant = 'default',
  className,
  children,
  ...rest
}: BadgeProps): ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

export default Badge;
