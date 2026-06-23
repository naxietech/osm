import React from 'react';

import { cn } from '@/lib/utils';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  /** Accessible label announced to screen readers. */
  label?: string;
  className?: string;
}

const sizeClasses: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export function Spinner({
  size = 'md',
  label = 'Loading',
  className,
}: SpinnerProps): React.ReactElement {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        'animate-spin rounded-full border-4 border-muted border-t-brand',
        sizeClasses[size],
        className,
      )}
    />
  );
}

export default Spinner;
