import { type ReactElement, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ChevronDown } from '@/design-system/atoms/icon';
import { cn } from '@/lib/utils';

import type { NavItem } from './nav.types';

export interface NavGroupProps {
  /** The group item — uses its label and children. */
  item: NavItem;
  /** Current path: marks the active child and auto-opens the group. */
  pathname: string;
}

/** Collapsible nav group — closed by default, auto-opens when a child is active. */
export function NavGroup({ item, pathname }: NavGroupProps): ReactElement {
  const Icon = item.icon;
  const children = item.children ?? [];
  const hasActiveChild = children.some((c) => c.to === pathname);
  const [open, setOpen] = useState(() => hasActiveChild);

  // Auto-open the group when navigating into one of its children.
  useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          hasActiveChild
            ? 'text-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        {Icon ? (
          <Icon className={cn('h-5 w-5 shrink-0', hasActiveChild && 'text-brand')} aria-hidden />
        ) : (
          <span
            className={cn('h-4 w-4 rounded', hasActiveChild ? 'bg-brand' : 'bg-current opacity-40')}
          />
        )}
        <span className="flex-1">{item.label}</span>
        <ChevronDown
          size={16}
          className={cn('shrink-0 transition-transform duration-200', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div className="ml-[1.4rem] mt-1 flex flex-col gap-1 border-l border-border pl-2">
          {children.map((child) => {
            const active = child.to === pathname;
            return (
              <Link
                key={child.label}
                to={child.to ?? '#'}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative rounded-md px-3 py-1.5 text-sm transition-colors',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  active
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-1 -left-2 w-0.5 rounded-full bg-brand"
                  />
                )}
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default NavGroup;
