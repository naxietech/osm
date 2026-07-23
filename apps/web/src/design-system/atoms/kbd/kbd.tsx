import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface KbdProps {
  children: ReactNode;
  className?: string;
}

/**
 * A single keycap, for showing a keyboard shortcut inline (e.g. <Kbd>Enter</Kbd>).
 *
 * Presentational and domain-free — it renders a `<kbd>`, nothing more, so any screen that
 * teaches a shortcut can use it.
 */
export function Kbd({ children, className }: KbdProps): React.ReactElement {
  return (
    <kbd
      className={cn(
        'rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export default Kbd;
