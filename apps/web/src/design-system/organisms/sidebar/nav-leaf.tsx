import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';

export interface NavLeafProps {
  label: string;
  to: string;
  /** Whether this link matches the current route. */
  active: boolean;
}

/** A single sidebar link (leaf). Presentational — active state is passed in. */
export function NavLeaf({ label, to, active }: NavLeafProps): ReactElement {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        active ? 'text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-y-1.5 -left-2 w-1 rounded-full bg-brand"
        />
      )}
      <span className={cn('h-4 w-4 rounded', active ? 'bg-brand' : 'bg-current opacity-40')} />
      {label}
    </Link>
  );
}

export default NavLeaf;
