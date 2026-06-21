import React from 'react';

import { cn } from '@/lib/utils';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export function Spinner({ size = 'md', className }: SpinnerProps): React.ReactElement {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'rounded-full border-4 border-gray-200 border-t-[#0E7490] animate-spin',
        sizeClasses[size],
        className,
      )}
    />
  );
}

export default Spinner;
